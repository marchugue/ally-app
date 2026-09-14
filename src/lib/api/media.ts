import { Platform } from "react-native";
import { API_BASE_URL } from "@/constants";
import { ApiError } from "./apiError";

export interface LocalFile { uri: string; name: string; type: string; }
export interface ChatMediaUploadResult { url: string; }
export interface PostMediaUploadResult { urls: string[]; }
export interface AvatarUploadResult { url: string; }

/**
 * Normalizes filenames and MIME types for React Native uploads.
 * Ensures image/jpg is converted to standard image/jpeg and proper extensions are assigned.
 */
export function sanitizeFile(file: LocalFile): { uri: string; name: string; type: string } {
  let uri = file.uri;
  let name = file.name || `upload_${Date.now()}.jpg`;

  // Remove query string or hashes from name
  name = name.split("?")[0].split("#")[0];

  const extMatch = /\.(\w+)$/.exec(name);
  let ext = extMatch ? extMatch[1].toLowerCase() : "";

  let type = file.type ? file.type.toLowerCase().trim() : "";

  if (!type || type === "image" || type === "image/*" || type === "image/jpg") {
    type = "image/jpeg";
  }

  if (ext === "jpg" || ext === "jpeg") {
    type = "image/jpeg";
  } else if (ext === "png") {
    type = "image/png";
  } else if (ext === "webp") {
    type = "image/webp";
  } else if (ext === "gif") {
    type = "image/gif";
  } else if (ext === "mp4") {
    type = "video/mp4";
  } else if (ext === "mov") {
    type = "video/quicktime";
  } else if (!ext) {
    if (type === "image/png") ext = "png";
    else if (type === "image/webp") ext = "webp";
    else if (type === "image/gif") ext = "gif";
    else if (type === "video/mp4") ext = "mp4";
    else if (type === "video/quicktime") ext = "mov";
    else {
      type = "image/jpeg";
      ext = "jpg";
    }
    name = `${name}.${ext}`;
  }

  return {
    uri,
    name,
    type,
  };
}

/**
 * Uploads FormData using React Native's native XMLHttpRequest.
 *
 * Why XMLHttpRequest instead of global fetch():
 * Expo SDK 57 overrides global.fetch with WinterCG fetch (RequestUtils.ts / convertFormData.ts),
 * which does not support React Native's `{ uri, name, type }` FormData parts and throws:
 * "Unsupported FormDataPart implementation".
 * React Native's native XMLHttpRequest bypasses WinterCG fetch and delegates directly
 * to Android's NetworkingModule / iOS RCTNetworking, which natively streams the file
 * from local device storage (file:// or content://) via OkHttp / NSURLSession.
 */
function uploadViaXHR<T>(path: string, formData: FormData, accessToken?: string): Promise<T> {
  const url = `${API_BASE_URL}/api${path}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    if (accessToken) {
      xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    }
    xhr.setRequestHeader("Accept", "application/json");

    xhr.onload = () => {
      let data: any = null;
      try {
        if (xhr.responseText) {
          data = JSON.parse(xhr.responseText);
        }
      } catch {
        data = xhr.responseText;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as T);
      } else {
        const message =
          data && typeof data === "object" && "message" in data
            ? String((data as { message: unknown }).message)
            : `Upload failed (${xhr.status})`;
        console.warn(`[uploadViaXHR] Upload rejected (${xhr.status}):`, message);
        reject(new ApiError(message, xhr.status));
      }
    };

    xhr.onerror = (err) => {
      console.warn(`[uploadViaXHR] Network failure POST ${url}:`, err);
      reject(new ApiError("Unable to reach the server. Check your connection.", 0));
    };

    xhr.ontimeout = () => {
      console.warn(`[uploadViaXHR] Timeout POST ${url}`);
      reject(new ApiError("Upload request timed out. Please try again.", 0));
    };

    xhr.timeout = 60000;
    xhr.send(formData);
  });
}

/** Helper to append a LocalFile to FormData across Native and Web */
async function appendFileToFormData(formData: FormData, fieldName: string, file: LocalFile): Promise<void> {
  const sanitized = sanitizeFile(file);
  if (Platform.OS === "web") {
    try {
      const res = await fetch(sanitized.uri);
      const blob = await res.blob();
      formData.append(fieldName, blob, sanitized.name);
      return;
    } catch {
      // fallback to native shape if fetch blob fails
    }
  }

  formData.append(fieldName, {
    uri: sanitized.uri,
    name: sanitized.name,
    type: sanitized.type,
  } as any);
}

/** POST /api/media/avatar — field name "file", returns { url } */
export async function uploadUserAvatar(
  file: LocalFile,
  accessToken: string
): Promise<AvatarUploadResult> {
  const formData = new FormData();
  await appendFileToFormData(formData, "file", file);
  return uploadViaXHR<AvatarUploadResult>("/media/avatar", formData, accessToken);
}

/** POST /api/media/chat — field name "file" */
export async function uploadChatFile(
  file: LocalFile,
  accessToken: string
): Promise<ChatMediaUploadResult> {
  const formData = new FormData();
  await appendFileToFormData(formData, "file", file);
  return uploadViaXHR<ChatMediaUploadResult>("/media/chat", formData, accessToken);
}

/** POST /api/media/posts — field name "files", max 4 */
export async function uploadPostFiles(
  files: LocalFile[],
  accessToken: string
): Promise<PostMediaUploadResult> {
  if (files.length === 0 || files.length > 4) {
    throw new ApiError("You can upload between 1 and 4 files.", 400);
  }
  const formData = new FormData();
  for (const file of files) {
    await appendFileToFormData(formData, "files", file);
  }
  return uploadViaXHR<PostMediaUploadResult>("/media/posts", formData, accessToken);
}

/** POST /api/auth/student-id/upload — field name "file", params "userId", "side" */
export async function uploadStudentIdFile(
  userId: string,
  localUri: string,
  side: "front" | "back" = "front"
): Promise<{ url: string; side: string }> {
  const filename = localUri.split("/").pop() || `id-${side}.jpg`;
  const formData = new FormData();
  formData.append("userId", userId);
  formData.append("side", side);
  await appendFileToFormData(formData, "file", { uri: localUri, name: filename, type: "image/jpeg" });

  return uploadViaXHR<{ url: string; side: string }>("/auth/student-id/upload", formData);
}