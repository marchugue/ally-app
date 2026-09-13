import { Image } from "react-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

export interface CropRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve({ width: 0, height: 0 })
    );
  });
}

/**
 * Ensures the image is in landscape format (width > height).
 * If the image is currently portrait, rotates it 90 degrees.
 */
export async function ensureLandscape(uri: string): Promise<string> {
  const size = await getImageSize(uri);
  if (size.height > size.width) {
    try {
      const manipulated = await manipulateAsync(
        uri,
        [{ rotate: 270 }],
        { compress: 0.88, format: SaveFormat.JPEG }
      );
      return manipulated.uri;
    } catch (err) {
      console.warn("[ensureLandscape] rotate error:", err);
      return uri;
    }
  }
  return uri;
}

/**
 * Crops a captured photo to match the exact viewfinder guide rectangle on screen,
 * then rotates it 90 degrees to landscape format.
 *
 * @param uri Image URI returned by CameraView takePictureAsync
 * @param screenW Screen window width (Dimensions.get("window").width)
 * @param screenH Screen window height (Dimensions.get("window").height)
 * @param guide Rect on screen representing the viewfinder frame
 */
export async function cropToGuideAndMakeLandscape(
  uri: string,
  screenW: number,
  screenH: number,
  guide: CropRect
): Promise<string> {
  const size = await getImageSize(uri);
  let imgW = size.width;
  let imgH = size.height;
  let currentUri = uri;

  if (imgW <= 0 || imgH <= 0) {
    return uri;
  }

  // If the captured photo came back in landscape (imgW > imgH) while screen is portrait,
  // rotate it 90 degrees first so it matches the portrait screen coordinate system.
  if (imgW > imgH && screenH > screenW) {
    try {
      const portraitFix = await manipulateAsync(
        currentUri,
        [{ rotate: 90 }],
        { compress: 0.95, format: SaveFormat.JPEG }
      );
      currentUri = portraitFix.uri;
      const newSize = await getImageSize(currentUri);
      imgW = newSize.width;
      imgH = newSize.height;
    } catch (e) {
      console.warn("[cropToGuide] portrait orientation fix error:", e);
    }
  }

  // CameraView with StyleSheet.absoluteFill scales the sensor image to COVER screenW x screenH
  const scale = Math.max(screenW / imgW, screenH / imgH);
  const renderedW = imgW * scale;
  const renderedH = imgH * scale;
  const offsetX = (screenW - renderedW) / 2;
  const offsetY = (screenH - renderedH) / 2;

  // Convert guide rectangle from screen space to image pixel space
  let originX = Math.round((guide.left - offsetX) / scale);
  let originY = Math.round((guide.top - offsetY) / scale);
  let cropW = Math.round(guide.width / scale);
  let cropH = Math.round(guide.height / scale);

  // Safety clamps to ensure crop rectangle stays within image bounds
  originX = Math.max(0, Math.min(imgW - 1, originX));
  originY = Math.max(0, Math.min(imgH - 1, originY));
  cropW = Math.max(1, Math.min(imgW - originX, cropW));
  cropH = Math.max(1, Math.min(imgH - originY, cropH));

  try {
    // 1. Crop to the guide frame
    // 2. Rotate 270 degrees to landscape format (flips top/bottom relative to 90deg)
    const result = await manipulateAsync(
      currentUri,
      [
        {
          crop: {
            originX,
            originY,
            width: cropW,
            height: cropH,
          },
        },
        { rotate: 270 },
      ],
      { compress: 0.88, format: SaveFormat.JPEG }
    );

    // Final safety check to ensure width > height
    return await ensureLandscape(result.uri);
  } catch (err) {
    console.warn("[cropToGuide] manipulate error:", err);
    return currentUri;
  }
}
