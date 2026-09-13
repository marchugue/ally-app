import { API_BASE_URL } from "@/constants";
import { ApiError } from "./apiError";

export interface LocalFile { uri: string; name: string; type: string; }
export interface ChatMediaUploadResult { url: string; }
export interface PostMediaUploadResult { urls: string[]; }
export interface AvatarUploadResult { url: string; }

/**
 * Multipart uploads bypass apiRequest — it always forces
 * Content-Type: application/json. fetch sets the correct
 * multipart boundary automatically for a FormData body.
 */
async function uploadRequest<T>(path: string, formData: FormData, accessToken: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
  } catch {
    throw new ApiError("Unable to reach the server. Check your connection.", 0);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : "Upload failed";
    throw new ApiError(message, response.status);
  }

  return data as T;
}

/** POST /api/media/avatar — field name "file", returns { url } */
export async function uploadUserAvatar(
  file: LocalFile,
  accessToken: string
): Promise<AvatarUploadResult> {
  const formData = new FormData();
  formData.append("file", file as unknown as Blob);
  return uploadRequest<AvatarUploadResult>("/media/avatar", formData, accessToken);
}

/** POST /api/media/chat — field name "file" */
export function uploadChatFile(file: LocalFile, accessToken: string): Promise<ChatMediaUploadResult> {
  const formData = new FormData();
  formData.append("file", file as unknown as Blob);
  return uploadRequest<ChatMediaUploadResult>("/media/chat", formData, accessToken);
}

/** POST /api/media/posts — field name "files", max 4 */
export function uploadPostFiles(files: LocalFile[], accessToken: string): Promise<PostMediaUploadResult> {
  if (files.length === 0 || files.length > 4) {
    throw new ApiError("You can upload between 1 and 4 files.", 400);
  }
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file as unknown as Blob));
  return uploadRequest<PostMediaUploadResult>("/media/posts", formData, accessToken);
}

/** POST /api/auth/student-id/upload — field name "file", params "userId", "side" */
export async function uploadStudentIdFile(
  userId: string,
  localUri: string,
  side: "front" | "back" = "front"
): Promise<{ url: string; side: string }> {
  const formData = new FormData();
  formData.append("userId", userId);
  formData.append("side", side);

  const filename = localUri.split("/").pop() || `id-${side}.jpg`;
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1].toLowerCase()}` : `image/jpeg`;

  formData.append("file", {
    uri: localUri,
    name: filename,
    type,
  } as any);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/auth/student-id/upload`, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new ApiError("Unable to reach the server. Check your connection.", 0);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : "Student ID upload failed";
    throw new ApiError(message, response.status);
  }

  return data;
}