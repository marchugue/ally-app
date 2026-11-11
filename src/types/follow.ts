// src/types/follow.ts

export interface FollowListItem {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  avatarKey?: string | null;
  course: string | null;
  department?: string | null;
  year_level?: string | null;
  yearLevel?: string | null;
  isAlly?: boolean;
  followedAt: string;
}

export interface PaginatedFollowList {
  items: FollowListItem[];
  nextCursor: string | null;
  totalCount?: number;
}

export interface FollowCounts {
  followersCount: number | null;
  followingCount: number | null;
  visibility?: {
    followers: boolean;
    following: boolean;
  };
}

export interface FollowStatusResponse {
  isFollowing: boolean;
  isFollowedBy: boolean;
}

export interface FollowFilterParams {
  search?: string;
  department?: string;
  course?: string;
  year_level?: string;
  sortBy?: 'recent' | 'name';
  cursor?: string | null;
}
