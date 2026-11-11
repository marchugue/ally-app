export type InteractionStatus = "pending" | "accepted" | "rejected";

export interface Interaction {
  user_id: string;
  target_user_id: string;
  status: InteractionStatus;
  accepted_at: string | null;
}

export interface InteractionStatusResponse {
  status: InteractionStatus | "none";
}

export interface AllyListItem {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  avatarKey?: string | null;
  course: string | null;
  department?: string | null;
  yearLevel?: string | null;
  isAlly?: boolean;
  alliedAt: string;
}

export interface PaginatedAllyList {
  items: AllyListItem[];
  nextCursor: string | null;
  totalCount?: number;
}

export interface AllyFilterParams {
  search?: string;
  department?: string;
  course?: string;
  year_level?: string;
  sortBy?: "recent" | "name";
  cursor?: string | null;
}