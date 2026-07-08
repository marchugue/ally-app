import { apiRequest } from "./client";
import type {
  FeedPost,
  CreatePostPayload,
  UpdatePostPayload,
  LikeResult,
  Comment,
  CreateCommentPayload,
} from "@/types/feed";

export function listFeed(accessToken: string): Promise<FeedPost[]> {
  return apiRequest<FeedPost[]>("/feed", { accessToken });
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