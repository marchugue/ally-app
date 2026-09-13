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

export interface NotificationRedirection {
  entityType: 'post' | 'comment' | 'conversation' | 'profile' | 'requests' | 'discover';
  targetId: string;
  route: string;
  params?: Record<string, string>;
  webUrl?: string;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  message?: string;
  title?: string;
  description?: string;
  timestamp?: string;
  created_at?: string;
  isRead?: boolean;
  read?: boolean;
  is_read?: boolean;
  fromUserId?: string;
  from_user_id?: string;
  post_id?: string;
  comment_id?: string;
  target_id?: string;
  user_id?: string;
  avatar_url?: string;
  user_avatar?: string;
  author_name?: string;
  user_name?: string;
  username?: string;
  redirection?: NotificationRedirection;
  from_user?:
    | {
        id?: string;
        username?: string;
        full_name?: string;
        avatar_url?: string;
      }
    | Array<{
        id?: string;
        username?: string;
        full_name?: string;
        avatar_url?: string;
      }>;
}