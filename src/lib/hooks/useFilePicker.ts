import { useCallback, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
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
 * Pick a photo from the library. Returns `null` when the therapist cancels or declines the
 * permission — cancellation is not an error and must not raise a toast.
 */
export async function pickImageFromLibrary(options?: {
  allowsEditing?: boolean;
  aspect?: [number, number];
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
  const asset = result.assets[0];
  const name = asset.fileName ?? fileNameFrom(asset.uri, "image");
  return {
    uri: asset.uri,
    name,
    mimeType: asset.mimeType ?? guessMime(name, "image/jpeg"),
    size: asset.fileSize,
  };
}

/** Take a new photo. Same contract as `pickImageFromLibrary`. */
export async function captureImage(options?: {
  allowsEditing?: boolean;
  aspect?: [number, number];
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
  const asset = result.assets[0];
  const name = asset.fileName ?? fileNameFrom(asset.uri, "photo");
  return {
    uri: asset.uri,
    name,
    mimeType: asset.mimeType ?? guessMime(name, "image/jpeg"),
    size: asset.fileSize,
  };
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
