export type NotificationType =
  | "friend_request"
  | "accepted"
  | "match"
  | "message"
  | "anon_match"
  | "new_follower"
  | "comment"
  | "post_comment"
  | "comment_reply"
  | "comment_like"
  | "like"
  | "post_like"
  | "feed"
  | "system"
  | string;

export interface NotificationItem {
  id: string;
  type: NotificationType;
  message: string;
  title?: string;
  description?: string;
  timestamp?: string;
  created_at?: string;
  isRead?: boolean;
  read?: boolean;
  fromUserId?: string;
  from_user_id?: string;
  post_id?: string;
  target_id?: string;
  user_id?: string;
  avatar_url?: string;
  user_avatar?: string;
  author_name?: string;
  user_name?: string;
  username?: string;
  from_user?: {
    id?: string;
    username?: string;
    full_name?: string;
    avatar_url?: string;
  };
}