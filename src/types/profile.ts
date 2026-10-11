export interface Profile {
  id: string;
  email: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  department: string | null;
  course: string | null;
  year_level: string | null;
  interests: string[];
  organizations: string[];
  created_at: string;
}

export interface ProfileSummary {
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string | null;
  course?: string | null;
}

export interface UpdateProfilePayload {
  full_name?: string;
  username?: string;
  avatar_url?: string | null;
  bio?: string | null;
  department?: string | null;
  course?: string | null;
  year_level?: string | null;
  interests?: string[];
  organizations?: string[];
}

export interface UserPreferences {
  user_id: string;
  discovery_enabled: boolean;
  match_gender_preference: 'any' | 'male' | 'female' | 'non-binary';
  match_department_preference: 'any' | 'same' | 'different';
  match_same_year_only: boolean;
  interests_strict_match: boolean;

  show_online_status: boolean;
  show_last_active: boolean;
  read_receipts_enabled: boolean;
  profile_visibility: 'campus' | 'matches_only' | 'hidden';
  feed_post_audience: 'campus' | 'matches_only' | 'anonymous_only';

  typing_indicators_enabled: boolean;
  auto_reveal_identity_stage: number;

  notify_chat_messages: boolean;
  notify_match_requests: boolean;
  notify_streak_reminders: boolean;
  notify_confessions: boolean;
  notify_sound_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;

  created_at?: string;
  updated_at?: string;
}

export type UpdateUserPreferencesPayload = Partial<Omit<UserPreferences, 'user_id' | 'created_at' | 'updated_at'>>;