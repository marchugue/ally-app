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