import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { useCallback, useRef, useState } from "react";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";

export function useCamera() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [lastPhoto, setLastPhoto] = useState<string | null>(null);
  const cameraRef = useRef<CameraView | null>(null);

  /**
   * Returns the full permission response (not just a boolean) so callers can tell "denied,
   * ask again" from "permanently denied" — `cameraPermission` state updates asynchronously
   * and reading it right after this resolves would race the state update.
   */
  const ensurePermission = useCallback(async () => {
    return requestCameraPermission();
  }, [requestCameraPermission]);

  const takePhoto = useCallback(async () => {
    const status = await ensurePermission();
    if (!status.granted || !cameraRef.current) return null;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: false,
      });
      const compressed = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );
      setLastPhoto(compressed.uri);
      return compressed.uri;
    } catch {
      return null;
    }
  }, [ensurePermission]);

  const getPhotoSize = useCallback(async (uri: string) => {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      return info.exists ? info.size : 0;
    } catch {
      return 0;
    }
  }, []);

  return {
    cameraPermission,
    micPermission,
    requestMicPermission,
    cameraRef,
    lastPhoto,
    ensurePermission,
    takePhoto,
    getPhotoSize,
  };
}
