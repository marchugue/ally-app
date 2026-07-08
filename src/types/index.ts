export interface User {
  id: string;
  name: string;
  handle: string;
  avatarUrl?: string;
  bio?: string;
  followersCount: number;
  followingCount: number;
}

export interface Post {
  id: string;
  authorId: string;
  content: string;
  imageUrl?: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: "like" | "follow" | "comment";
  actorId: string;
  postId?: string;
  read: boolean;
  createdAt: string;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}
