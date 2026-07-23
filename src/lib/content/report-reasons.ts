/**
 * The report vocabulary, shared by the filing form, the moderation queue and
 * the Server Actions.
 *
 * Deliberately not `server-only`: the form that offers these choices is a
 * client component, and the labels must match the enums in migration 0009
 * exactly. Adding a reason means a migration first, then this list.
 */

export const REPORT_REASONS = [
  "spam",
  "harassment",
  "hate_speech",
  "violence",
  "sexual_content",
  "misinformation",
  "impersonation",
  "off_topic",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ["open", "under_review", "resolved", "dismissed"] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

/**
 * Reporter-facing wording: what the reporter is claiming, not what a moderator
 * would conclude. Sentence case, no euphemism, no accusation of the reader.
 */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam or repeated advertising",
  harassment: "Harassment or targeted abuse",
  hate_speech: "Hate speech",
  violence: "Violence or threats",
  sexual_content: "Sexual content",
  misinformation: "Misleading or false information",
  impersonation: "Impersonation",
  off_topic: "Off topic for this Plaza",
  other: "Something else",
};

/** Moderator-facing wording for the queue filter. */
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: "Open",
  under_review: "Under review",
  resolved: "Resolved",
  dismissed: "Dismissed",
};
