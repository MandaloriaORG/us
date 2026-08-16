import type { Database } from "@/lib/database.types";

type Enums = Database["public"]["Enums"];

export type CodexArticleStatus = Enums["codex_article_status"];
export type CodexSuggestionStatus = Enums["codex_suggestion_status"];
export type CodexProposalStatus = Enums["codex_proposal_status"];
export type CodexAttribution = Enums["codex_attribution"];
export type CodexContributionStatus = Enums["codex_contribution_status"];
export type CodexContributionType = Enums["codex_contribution_type"];
export type CodexSourceType = Enums["codex_source_type"];

/**
 * Human labels for the Codex state machines. States are the source of truth in
 * the database; these names only translate them for a reader. A status never
 * changes meaning because a translation does.
 */
export const ARTICLE_STATUS_LABELS: Record<CodexArticleStatus, string> = {
  draft: "Draft",
  published: "Published",
  unpublished: "Unpublished",
  archived: "Archived",
  locked: "Locked",
};

/** A published or locked article is what the public list can show. */
export const PUBLIC_ARTICLE_STATUSES: readonly CodexArticleStatus[] = ["published", "locked"];

export const SUGGESTION_STATUS_LABELS: Record<CodexSuggestionStatus, string> = {
  open: "Open",
  accepted: "Accepted",
  rejected: "Rejected",
  merged: "Merged",
};

export const PROPOSAL_STATUS_LABELS: Record<CodexProposalStatus, string> = {
  proposed: "Proposed",
  classified: "Classified",
  drafting: "Drafting",
  reviewed: "Reviewed",
  published: "Published",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  reopened: "Reopened",
  replaced: "Replaced",
};

export const CONTRIBUTION_TYPE_LABELS: Record<CodexContributionType, string> = {
  question: "Question",
  explanation: "Explanation",
  evidence: "Evidence",
  synthesis: "Synthesis",
  review: "Review",
  edit: "Edit",
};

export const ATTRIBUTION_LABELS: Record<CodexAttribution, string> = {
  public: "Public",
  anonymous: "Anonymous",
  withdrawn: "Withdrawn",
};

export const CONTRIBUTION_STATUS_LABELS: Record<CodexContributionStatus, string> = {
  proposed: "Proposed",
  confirmed: "Confirmed",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const SOURCE_TYPE_LABELS: Record<CodexSourceType, string> = {
  post: "Post",
  comment: "Comment",
  chat_message: "Chat message",
  external: "External link",
};

/**
 * A proposal is still open to edits and to the proposer's withdrawal until it is
 * published, rejected, withdrawn or replaced. Mirrors
 * `private.codex_proposal_is_open` in migration 0015 so the UI offers the same
 * actions the RPCs will accept.
 */
export function isOpenProposalStatus(status: CodexProposalStatus): boolean {
  return (
    status === "proposed" ||
    status === "classified" ||
    status === "drafting" ||
    status === "reviewed" ||
    status === "reopened"
  );
}
