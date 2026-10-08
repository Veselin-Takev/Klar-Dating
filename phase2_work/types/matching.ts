import type { Timestamp } from "firebase-admin/firestore";

export interface MatchFeedbackPayload {
  matchId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  conversationQuality: "engaging" | "slow" | "ghosted" | "inappropriate" | "moved_offline";
  safetyRating: "safe" | "suspicious" | "unsafe";
  tags?: string[];
  comment?: string;
}

export interface MatchMetricRecord {
  matchId: string;
  userA: string;
  userB: string;
  feedbackA?: MatchFeedbackPayload;
  feedbackB?: MatchFeedbackPayload;
  matchedAt: Timestamp;
  firstMessageLatencyMinutes?: number;
  totalMessagesExchanged: number;
  mutualSuccessScore?: number;
}
