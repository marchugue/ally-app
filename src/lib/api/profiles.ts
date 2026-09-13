import { apiRequest } from "./client";
import type { Profile, ProfileSummary, UpdateProfilePayload } from "@/types/profile";

export function getMyProfile(accessToken: string): Promise<Profile> {
  return apiRequest<Profile>("/profiles/me", { accessToken });
}

export function updateMyProfile(payload: UpdateProfilePayload, accessToken: string): Promise<Profile> {
  return apiRequest<Profile>("/profiles/me", { method: "PATCH", body: payload, accessToken });
}

export function deleteMyProfile(accessToken: string): Promise<void> {
  return apiRequest<void>("/profiles/me", { method: "DELETE", accessToken, noContent: true });
}

export function getProfilesBatch(ids: string[], accessToken: string): Promise<Profile[]> {
  return apiRequest<Profile[]>("/profiles/batch", { method: "POST", body: { ids }, accessToken });
}

/** Public — called from the registration form before a session exists. */
export function checkUsernameAvailable(username: string, excludeId?: string): Promise<{ available: boolean }> {
  const query = new URLSearchParams({ username });
  if (excludeId) query.set("excludeId", excludeId);
  return apiRequest<{ available: boolean }>(`/profiles/check-username?${query}`);
}

export interface ProfileFilterParams {
  excludeId?: string;
  search?: string;
  department?: string;
  course?: string;
  year_level?: string;
  interest?: string;
  sortBy?: "match" | "popular" | "name" | "recent";
}

export function listProfiles(
  accessToken: string,
  excludeIdOrParams?: string | ProfileFilterParams
): Promise<ProfileSummary[]> {
  const params: ProfileFilterParams =
    typeof excludeIdOrParams === "string"
      ? { excludeId: excludeIdOrParams }
      : excludeIdOrParams || {};

  const query = new URLSearchParams();
  if (params.excludeId) query.set("excludeId", params.excludeId);
  if (params.search) query.set("search", params.search);
  if (params.department) query.set("department", params.department);
  if (params.course) query.set("course", params.course);
  if (params.year_level) query.set("year_level", params.year_level);
  if (params.interest) query.set("interest", params.interest);
  if (params.sortBy) query.set("sortBy", params.sortBy);

  const qs = query.toString();
  return apiRequest<ProfileSummary[]>(`/profiles${qs ? `?${qs}` : ""}`, { accessToken });
}

export function listDiscoverProfiles(
  accessToken: string,
  params?: Omit<ProfileFilterParams, "sortBy">
): Promise<ProfileSummary[]> {
  const query = new URLSearchParams();
  if (params?.excludeId) query.set("excludeId", params.excludeId);
  if (params?.search) query.set("search", params.search);
  if (params?.department) query.set("department", params.department);
  if (params?.course) query.set("course", params.course);
  if (params?.year_level) query.set("year_level", params.year_level);
  if (params?.interest) query.set("interest", params.interest);

  const qs = query.toString();
  return apiRequest<ProfileSummary[]>(`/profiles/discover${qs ? `?${qs}` : ""}`, { accessToken });
}

export function getProfileById(userId: string, accessToken: string): Promise<Profile> {
  return apiRequest<Profile>(`/profiles/${userId}`, { accessToken });
}

export interface ProfileRelationshipSummary {
  allyStatus: "none" | "pending_sent" | "pending_received" | "accepted";
  isFollowing: boolean;
  isFollowedBy: boolean;
  followersCount: number;
  followingCount: number;
  alliesCount: number;
  mutualAlliesCount: number;
  mutualFollowersCount: number;
}

export function getProfileRelationship(userId: string, accessToken: string): Promise<ProfileRelationshipSummary> {
  return apiRequest<ProfileRelationshipSummary>(`/profiles/${userId}/relationship`, { accessToken });
}

export { followUser, unfollowUser } from "./follow";

export function updatePushToken(expoPushToken: string | null, accessToken: string): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>("/profiles/push-token", {
    method: "POST",
    body: { expoPushToken },
    accessToken,
  });
}