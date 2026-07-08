export type InteractionStatus = "pending" | "accepted" | "rejected";

export interface Interaction {
  user_id: string;
  target_user_id: string;
  status: InteractionStatus;
  accepted_at: string | null;
}

export interface InteractionStatusResponse {
  status: InteractionStatus | "none";
}