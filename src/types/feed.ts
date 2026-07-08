export type PostAudience = "public" | "connections";

export interface PostAuthor {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
}

export interface FeedPost {
  id: string;
  author_id: string;
  content: string;
  audience: PostAudience;
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  author: PostAuthor;
  liked_by_me: boolean;
  media: string[];
}

export interface CreatePostPayload {
  content: string;
  audience: PostAudience;
  mediaUrls?: string[];
}

export interface UpdatePostPayload {
  content?: string;
  audience?: PostAudience;
}

export interface LikeResult { liked: boolean; likesCount: number; }

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id: string | null;
  content: string;
  likes_count: number;
  created_at: string;
  updated_at: string;
  author: PostAuthor;
  liked_by_me: boolean;
}

export interface CreateCommentPayload {
  content: string;
  parentCommentId?: string | null;
}