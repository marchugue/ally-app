export interface ConversationMemberProfile {
  id: string;
  full_name: string;
  username: string;
  avatar_url?: string | null;
}

export interface ConversationMember {
  conversation_id: string;
  user_id: string;
  last_read_at: string | null;
  icebreakers_enabled?: boolean;
  profiles?: ConversationMemberProfile | ConversationMemberProfile[];
}

export interface ConversationMembership {
  conversation_id: string;
  last_read_at: string | null;
  icebreakers_enabled: boolean;
  profiles: ConversationMemberProfile[];
}

export type BlockStatus = "none" | "blocked" | "blocked_by";

export interface MessageReaction {
  message_id: string;
  user_id: string;
  emoji: string;
}

export type MessageGroupPosition = "single" | "first" | "middle" | "last";

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  reply_to_message_id: string | null;
  replied_message: Message | null;
  reactions: MessageReaction[];
  status?: "sending" | "sent" | "failed";
}

export interface Conversation {
  id: string;
  updated_at: string;
  messages: Message[];
  conversation_members: ConversationMember[];
  blockStatus: BlockStatus;
  variant?: "regular" | "anonymous" | "anonymous_ended";
  matchInfo?: any;
  dayStreak?: number;
  streakActiveToday?: boolean;
}

export interface SendMessagePayload {
  content: string;
  imageUrl?: string | null;
  replyToMessageId?: string | null;
}