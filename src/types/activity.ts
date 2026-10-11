// src/types/activity.ts

export type ActivityBucket = 'content' | 'connections' | 'security' | 'safety';

export interface ActivityLogRow {
  id: string;
  user_id: string;
  bucket: ActivityBucket;
  action: string;
  title: string;
  summary: string | null;
  target_type: 'post' | 'profile' | 'comment' | 'security' | 'settings' | null;
  target_id: string | null;
  device_info: string | null;
  ip_address: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface ActivityGroup {
  dateLabel: string;
  dateKey: string;
  items: ActivityLogRow[];
}

export interface FormattedActivityResponse {
  items: ActivityLogRow[];
  groups: ActivityGroup[];
  nextCursor?: string;
  totalCount: number;
}

export interface ListActivityLogsParams {
  bucket?: ActivityBucket | 'all';
  limit?: number;
  cursor?: string;
}
