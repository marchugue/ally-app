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

export function listProfiles(accessToken: string, excludeId?: string): Promise<ProfileSummary[]> {
  const query = excludeId ? `?excludeId=${excludeId}` : "";
  return apiRequest<ProfileSummary[]>(`/profiles${query}`, { accessToken });
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

export function followUser(userId: string, accessToken: string): Promise<{ following: boolean }> {
  return apiRequest<{ following: boolean }>(`/follow/${userId}`, { method: "POST", accessToken });
}

export function unfollowUser(userId: string, accessToken: string): Promise<{ following: boolean }> {
  return apiRequest<{ following: boolean }>(`/follow/${userId}`, { method: "DELETE", accessToken });
}

export function updatePushToken(expoPushToken: string | null, accessToken: string): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>("/profiles/push-token", {
    method: "POST",
    body: { expoPushToken },
    accessToken,
  });
}