// src/lib/api/activityLogs.ts

import { apiRequest } from "./client";
import type {
  ActivityBucket,
  FormattedActivityResponse,
  ListActivityLogsParams,
} from "@/types/activity";

export async function listActivityLogs(
  accessToken: string,
  params?: ListActivityLogsParams
): Promise<FormattedActivityResponse> {
  const query = new URLSearchParams();
  if (params?.bucket && params.bucket !== "all") {
    query.set("bucket", params.bucket);
  }
  if (params?.limit) {
    query.set("limit", String(params.limit));
  }
  if (params?.cursor) {
    query.set("cursor", params.cursor);
  }

  const qs = query.toString();
  const res = await apiRequest<{ success: boolean; data: FormattedActivityResponse }>(
    `/activity-logs${qs ? `?${qs}` : ""}`,
    { accessToken }
  );

  return res.data;
}

export function deleteActivityLog(
  id: string,
  accessToken: string
): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>(`/activity-logs/${id}`, {
    method: "DELETE",
    accessToken,
  });
}

export function clearActivityLogs(
  accessToken: string,
  bucket?: ActivityBucket
): Promise<{ success: boolean; message: string }> {
  const qs = bucket ? `?bucket=${encodeURIComponent(bucket)}` : "";
  return apiRequest<{ success: boolean; message: string }>(`/activity-logs${qs}`, {
    method: "DELETE",
    accessToken,
  });
}
