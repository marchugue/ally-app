// src/lib/api/follow.ts

import { apiRequest } from "./client";
import type {
  FollowCounts,
  FollowFilterParams,
  FollowStatusResponse,
  PaginatedFollowList,
} from "@/types/follow";

export function followUser(userId: string, accessToken: string): Promise<void> {
  return apiRequest<void>(`/follows/${userId}`, { method: "POST", accessToken, noContent: true });
}

export function unfollowUser(userId: string, accessToken: string): Promise<void> {
  return apiRequest<void>(`/follows/${userId}`, { method: "DELETE", accessToken, noContent: true });
}

export function getFollowStatus(userId: string, accessToken: string): Promise<FollowStatusResponse> {
  return apiRequest<FollowStatusResponse>(`/follows/status/${userId}`, { accessToken });
}

export function getFollowCounts(userId: string, accessToken: string): Promise<FollowCounts> {
  return apiRequest<FollowCounts>(`/follows/counts/${userId}`, { accessToken });
}

export function listFollowers(
  userId: string,
  accessToken: string,
  params?: FollowFilterParams
): Promise<PaginatedFollowList> {
  const query = new URLSearchParams();
  if (params?.cursor) query.set("cursor", params.cursor);
  if (params?.search) query.set("search", params.search);
  if (params?.department) query.set("department", params.department);
  if (params?.course) query.set("course", params.course);
  if (params?.year_level) query.set("year_level", params.year_level);
  if (params?.sortBy) query.set("sortBy", params.sortBy);

  const qs = query.toString();
  return apiRequest<PaginatedFollowList>(`/follows/${userId}/followers${qs ? `?${qs}` : ""}`, { accessToken });
}

export function listFollowing(
  userId: string,
  accessToken: string,
  params?: FollowFilterParams
): Promise<PaginatedFollowList> {
  const query = new URLSearchParams();
  if (params?.cursor) query.set("cursor", params.cursor);
  if (params?.search) query.set("search", params.search);
  if (params?.department) query.set("department", params.department);
  if (params?.course) query.set("course", params.course);
  if (params?.year_level) query.set("year_level", params.year_level);
  if (params?.sortBy) query.set("sortBy", params.sortBy);

  const qs = query.toString();
  return apiRequest<PaginatedFollowList>(`/follows/${userId}/following${qs ? `?${qs}` : ""}`, { accessToken });
}
