import { useCallback, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { uploadApi } from "@/lib/api/services";

/** A file the therapist chose, normalised across the image and document pickers. */
export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  /** Bytes, when the picker reported it. */
  size?: number;
}

/** 8 MB — comfortably above a phone photo, below anything that will stall on mobile data. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Guess a MIME type from the file extension.
 *
 * `launchImageLibraryAsync` populates `mimeType` on both platforms in SDK 56, but
 * `launchCameraAsync` has historically left it undefined on some Android OEM camera apps, and
 * the multipart part must carry a real type or multer stores the file as
 * `application/octet-stream` — which then can't be rendered back as an avatar.
 */
function guessMime(name: string, fallback = "application/octet-stream"): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    case "pdf":
      return "application/pdf";
    default:
      return fallback;
  }
}

function fileNameFrom(uri: string, prefix: string): string {
  const tail = uri.split("/").pop();
  if (tail && tail.includes(".")) return tail;
  return `${prefix}-${Date.now()}.jpg`;
}

/**
 * Longest-edge caps, in pixels.
 *
 * `quality: 0.7` on the picker shrinks the FILE, not the image — a 4000×3000 photo comes back
 * still 4000×3000. File size decides upload time; pixel count decides memory, because anything
 * that later displays the image decodes every pixel. A 12 MP photo is a ~48 MB bitmap, which is
 * how avatars became the largest RAM cost in the app. Capping the dimensions here fixes it at the
 * source, for every future upload and every screen that shows one.
 *
 *   - avatar: shown at 36–96 dp. 512 px covers the largest size at 3x density with headroom.
 *   - document: credential scans a verifier must read. 2000 px on the long edge keeps an A4 page
 *     legible at roughly 170 DPI — deliberately generous, since an unreadable licence is worse
 *     than a larger file.
 */
export const IMAGE_MAX_EDGE = { avatar: 512, document: 2000 } as const;

/**
 * Downscale a picked image so its longest edge is at most `maxEdge`, re-encoding as JPEG.
 *
 * A no-op when the image is already small enough, or when the picker did not report dimensions
 * (nothing reliable to compare against — uploading the original beats guessing). Never throws: a
 * manipulation failure falls back to the original file, because failing the whole upload over an
 * optimisation would be the wrong trade.
 *
 * Uses the SDK 56 contextual API; `manipulateAsync` is deprecated in this version.
 */
async function downscale(
  asset: ImagePicker.ImagePickerAsset,
  maxEdge: number,
): Promise<{ uri: string; resized: boolean }> {
  const { width, height } = asset;
  if (!width || !height || Math.max(width, height) <= maxEdge) {
    return { uri: asset.uri, resized: false };
  }
  const context = ImageManipulator.manipulate(asset.uri);
  let rendered: Awaited<ReturnType<typeof context.renderAsync>> | null = null;
  try {
    // Only the longer side is given; the library derives the other to preserve the aspect ratio.
    context.resize(width >= height ? { width: maxEdge } : { height: maxEdge });
    rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
    return { uri: saved.uri, resized: true };
  } catch {
    return { uri: asset.uri, resized: false };
  } finally {
    // Both are native shared objects holding decoded bitmap memory. Releasing them now rather
    // than whenever the GC gets round to it is the point — this runs precisely when memory is
    // tightest, straight after the picker has handed back a full-resolution photo.
    rendered?.release();
    context.release();
  }
}

/** Normalise a picker asset into a `PickedFile`, downscaled to `maxEdge`. */
async function toPickedImage(
  asset: ImagePicker.ImagePickerAsset,
  prefix: string,
  maxEdge: number,
): Promise<PickedFile> {
  const { uri, resized } = await downscale(asset, maxEdge);
  if (resized) {
    // Re-encoded as JPEG, so a HEIC or PNG original must not keep its old extension and MIME
    // type — multer would store a JPEG labelled `image/heic`, and it would not render back.
    const base = (asset.fileName ?? `${prefix}-${Date.now()}`).replace(/\.[^.]+$/, "");
    return { uri, name: `${base}.jpg`, mimeType: "image/jpeg" };
  }
  const name = asset.fileName ?? fileNameFrom(asset.uri, prefix);
  return {
    uri: asset.uri,
    name,
    mimeType: asset.mimeType ?? guessMime(name, "image/jpeg"),
    size: asset.fileSize,
  };
}

/**
 * Pick a photo from the library. Returns `null` when the therapist cancels or declines the
 * permission — cancellation is not an error and must not raise a toast.
 */
export async function pickImageFromLibrary(options?: {
  allowsEditing?: boolean;
  aspect?: [number, number];
  /** Longest-edge cap in px. Defaults to the document cap; pass `IMAGE_MAX_EDGE.avatar` for photos of people. */
  maxEdge?: number;
}): Promise<PickedFile | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error("Photo access is needed to choose an image.");

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images",
    allowsEditing: options?.allowsEditing ?? true,
    aspect: options?.aspect,
    // Recompress on the way out. A modern phone photo is 4–8 MB straight off the sensor; at
    // 0.7 it lands around 300–600 KB with no visible loss at avatar or document-scan size,
    // which is the difference between an upload that completes on 3G and one that times out.
    quality: 0.7,
  });

  if (result.canceled || !result.assets?.length) return null;
  return toPickedImage(result.assets[0], "image", options?.maxEdge ?? IMAGE_MAX_EDGE.document);
}

/** Take a new photo. Same contract as `pickImageFromLibrary`. */
export async function captureImage(options?: {
  allowsEditing?: boolean;
  aspect?: [number, number];
  /** Longest-edge cap in px — see `pickImageFromLibrary`. */
  maxEdge?: number;
}): Promise<PickedFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error("Camera access is needed to take a photo.");

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: "images",
    allowsEditing: options?.allowsEditing ?? true,
    aspect: options?.aspect,
    quality: 0.7,
  });

  if (result.canceled || !result.assets?.length) return null;
  return toPickedImage(result.assets[0], "photo", options?.maxEdge ?? IMAGE_MAX_EDGE.document);
}

/** Pick a PDF or image from the device's file browser. */
export async function pickDocument(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/*"],
    // Required: the picked URI can be a provider content:// handle that the upload layer can't
    // read. Copying to the cache first gives a plain file:// path FormData can stream.
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType ?? guessMime(asset.name),
    size: asset.size,
  };
}

/**
 * Pick-then-upload, with the busy flag and error handling every caller needs.
 *
 * Returns the uploaded file's absolute URL, or `null` if the therapist cancelled. Anything
 * that actually went wrong throws, so the caller can surface it — a silent `null` on a real
 * failure would look identical to a cancellation and leave them wondering.
 */
export function useFileUpload(kind?: string) {
  const [busy, setBusy] = useState(false);

  const upload = useCallback(
    async (pick: () => Promise<PickedFile | null>): Promise<{ url: string; file: PickedFile } | null> => {
      const file = await pick();
      if (!file) return null;
      if (file.size != null && file.size > MAX_UPLOAD_BYTES) {
        throw new Error(
          `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Please choose one under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
        );
      }
      setBusy(true);
      try {
        const { url } = await uploadApi.uploadDocument(file.uri, file.name, file.mimeType, kind);
        return { url, file };
      } finally {
        setBusy(false);
      }
    },
    [kind],
  );

  return { busy, upload };
}
