import { apiRequest } from "./client";
import type {
  FeedPost,
  CreatePostPayload,
  UpdatePostPayload,
  LikeResult,
  Comment,
  CreateCommentPayload,
} from "@/types/feed";

export interface FeedFilterParams {
  filter?: 'all' | 'allies' | 'following' | 'discover' | 'popular';
  department?: string;
  course?: string;
  interest?: string;
  search?: string;
  mediaOnly?: boolean;
}

export function listFeed(accessToken: string, params?: FeedFilterParams): Promise<FeedPost[]> {
  const query = new URLSearchParams();
  if (params?.filter) query.set('filter', params.filter);
  if (params?.department) query.set('department', params.department);
  if (params?.course) query.set('course', params.course);
  if (params?.interest) query.set('interest', params.interest);
  if (params?.search) query.set('search', params.search);
  if (params?.mediaOnly !== undefined) query.set('mediaOnly', String(params.mediaOnly));

  const qs = query.toString();
  return apiRequest<FeedPost[]>(`/feed${qs ? `?${qs}` : ''}`, { accessToken });
}

export function listDiscoverFeed(accessToken: string, params?: Omit<FeedFilterParams, 'filter'>): Promise<FeedPost[]> {
  const query = new URLSearchParams();
  if (params?.department) query.set('department', params.department);
  if (params?.course) query.set('course', params.course);
  if (params?.interest) query.set('interest', params.interest);
  if (params?.search) query.set('search', params.search);
  if (params?.mediaOnly !== undefined) query.set('mediaOnly', String(params.mediaOnly));

  const qs = query.toString();
  return apiRequest<FeedPost[]>(`/feed/discover${qs ? `?${qs}` : ''}`, { accessToken });
}

export function listFeedByUser(userId: string, accessToken: string): Promise<FeedPost[]> {
  return apiRequest<FeedPost[]>(`/feed/users/${userId}`, { accessToken });
}

export function createPost(payload: CreatePostPayload, accessToken: string): Promise<FeedPost> {
  return apiRequest<FeedPost>("/feed/posts", { method: "POST", body: payload, accessToken });
}

export function getPost(postId: string, accessToken: string): Promise<FeedPost> {
  return apiRequest<FeedPost>(`/feed/posts/${postId}`, { accessToken });
}

export function updatePost(postId: string, payload: UpdatePostPayload, accessToken: string): Promise<FeedPost> {
  return apiRequest<FeedPost>(`/feed/posts/${postId}`, { method: "PATCH", body: payload, accessToken });
}

export function deletePost(postId: string, accessToken: string): Promise<void> {
  return apiRequest<void>(`/feed/posts/${postId}`, { method: "DELETE", accessToken, noContent: true });
}

export function likePost(postId: string, accessToken: string): Promise<LikeResult> {
  return apiRequest<LikeResult>(`/feed/posts/${postId}/like`, { method: "POST", accessToken });
}

export function unlikePost(postId: string, accessToken: string): Promise<LikeResult> {
  return apiRequest<LikeResult>(`/feed/posts/${postId}/like`, { method: "DELETE", accessToken });
}

export function listComments(postId: string, accessToken: string): Promise<Comment[]> {
  return apiRequest<Comment[]>(`/feed/posts/${postId}/comments`, { accessToken });
}

export function createComment(
  postId: string,
  payload: CreateCommentPayload,
  accessToken: string
): Promise<Comment> {
  return apiRequest<Comment>(`/feed/posts/${postId}/comments`, { method: "POST", body: payload, accessToken });
}

export function updateComment(
  commentId: string,
  payload: { content: string },
  accessToken: string
): Promise<Comment> {
  return apiRequest<Comment>(`/feed/comments/${commentId}`, { method: "PATCH", body: payload, accessToken });
}

export function deleteComment(commentId: string, accessToken: string): Promise<void> {
  return apiRequest<void>(`/feed/comments/${commentId}`, { method: "DELETE", accessToken, noContent: true });
}

export function likeComment(commentId: string, accessToken: string): Promise<LikeResult> {
  return apiRequest<LikeResult>(`/feed/comments/${commentId}/like`, { method: "POST", accessToken });
}

export function unlikeComment(commentId: string, accessToken: string): Promise<LikeResult> {
  return apiRequest<LikeResult>(`/feed/comments/${commentId}/like`, { method: "DELETE", accessToken });
}