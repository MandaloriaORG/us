import "server-only";

import type { Database } from "@/lib/database.types";
import { decodeCursor, encodeCursor } from "@/lib/content/cursor";
import { createClient } from "@/lib/supabase/server";
import type { CodexProposalStatus, CodexSuggestionStatus } from "@/lib/codex/states";

/**
 * Read paths for Codex Libre.
 *
 * Every codex table is RLS-enabled with no policies and no grants for `anon` or
 * `authenticated`, so each read goes through a minimized SECURITY DEFINER RPC
 * that re-checks visibility and permission inside the database. This module only
 * shapes results, bounds pagination, and degrades a failed read to an empty page
 * or `null` — a database fault must never leak its message into a page.
 *
 * The privacy boundary lives here too: a proposal's sources are only ever
 * resolved through `list_codex_proposal_sources`, which blanks the label of a
 * source the caller can no longer open. This module never reads the codex
 * tables directly, so it cannot bypass that check.
 */

type Functions = Database["public"]["Functions"];

/**
 * Type generation cannot infer nullability for `RETURNS TABLE` columns, so it
 * types every one as non-null. The RPCs legitimately blank several of them —
 * a proposal without an assignee or article, a version whose editor left — so
 * these aliases restore the truth at the one boundary where it is known.
 */
type Nullable<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] | null };

export type CodexCategory = Functions["list_codex_categories"]["Returns"][number];

export type ArticleSummary = Nullable<
  Functions["list_codex_articles"]["Returns"][number],
  "excerpt"
>;

export type ArticleDetail = Nullable<Functions["get_codex_article"]["Returns"][number], "excerpt">;

export type CodexVersion = Nullable<
  Functions["list_codex_versions"]["Returns"][number],
  "editor_id" | "editor_display_name" | "change_summary"
>;

export type BookmarkSummary = Functions["list_own_codex_bookmarks"]["Returns"][number];

export type OwnSuggestion = Nullable<
  Functions["list_own_codex_suggestions"]["Returns"][number],
  "review_note" | "reviewed_at"
>;

export type OwnProposal = Nullable<
  Functions["list_own_codex_proposals"]["Returns"][number],
  "working_title" | "article_id" | "article_slug"
>;

export type SuggestionQueueRow = Functions["moderation_list_codex_suggestions"]["Returns"][number];

export type ProposalQueueRow = Nullable<
  Functions["moderation_list_codex_proposals"]["Returns"][number],
  "assignee_id" | "assignee_display_name"
>;

export type ProposalDetail = Nullable<
  Functions["get_codex_proposal"]["Returns"][number],
  | "working_title"
  | "assignee_id"
  | "assignee_display_name"
  | "article_id"
  | "article_slug"
  | "replaced_by"
>;

export type ProposalSource = Nullable<
  Functions["list_codex_proposal_sources"]["Returns"][number],
  "label" | "note" | "added_by_display_name"
>;

export type ProposalContributor = Nullable<
  Functions["list_codex_proposal_contributors"]["Returns"][number],
  "member_display_name" | "evidence_ref" | "confirmed_by" | "confirmed_at"
>;

export const CODEX_PAGE_SIZE = 25;
export const CODEX_QUEUE_PAGE_SIZE = 25;
export const VERSION_PAGE_SIZE = 50;

export interface CodexPage<T> {
  items: T[];
  nextCursor: string | null;
}

function emptyPage<T>(): CodexPage<T> {
  return { items: [], nextCursor: null };
}

/**
 * A full page implies there may be another one. Requesting `pageSize` and
 * reporting the last row as the cursor avoids the extra count query an offset
 * scheme would need, at the cost of one possible empty final page.
 */
function toCodexPage<T>(
  rows: T[] | null,
  pageSize: number,
  createdAtOf: (row: T) => string,
  idOf: (row: T) => string,
): CodexPage<T> {
  const items = rows ?? [];
  if (items.length < pageSize) return { items, nextCursor: null };

  const last = items[items.length - 1];
  return { items, nextCursor: encodeCursor({ createdAt: createdAtOf(last), id: idOf(last) }) };
}

function boundedLimit(requested: number | undefined, fallback: number, max: number) {
  if (typeof requested !== "number" || !Number.isInteger(requested)) return fallback;
  return Math.min(Math.max(requested, 1), max);
}

export async function listCodexCategories(): Promise<CodexCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_codex_categories");
  if (error) return [];
  return data ?? [];
}

export interface ListArticlesOptions {
  categorySlug?: string | null;
  query?: string | null;
  cursor?: string | null;
  pageSize?: number;
}

/**
 * The published library, optionally narrowed by category and a plain-text
 * search of the title and excerpt. Full-body search belongs to the community
 * search surface; this is the focused library filter and it stays inside the
 * paginated list so every row links to its article.
 */
export async function listArticles(
  options: ListArticlesOptions = {},
): Promise<CodexPage<ArticleSummary>> {
  const pageSize = boundedLimit(options.pageSize, CODEX_PAGE_SIZE, 50);
  const cursor = decodeCursor(options.cursor);
  const query = normalizeQuery(options.query);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_codex_articles", {
    p_category_slug: options.categorySlug ?? undefined,
    p_cursor_created_at: cursor?.createdAt,
    p_cursor_id: cursor?.id,
    p_limit: pageSize * 4,
  });

  if (error) return emptyPage();

  const rows = (data ?? []) as ArticleSummary[];
  const filtered = query
    ? rows.filter(
        (row) =>
          row.title.toLowerCase().includes(query) ||
          (row.excerpt ?? "").toLowerCase().includes(query) ||
          row.category_name.toLowerCase().includes(query),
      )
    : rows;

  const items = filtered.slice(0, pageSize);
  if (items.length === 0) return { items: [], nextCursor: null };

  // The window is the whole library when it comes back short, and the filter
  // has nothing left to show when every match fits on this page.
  const windowExhausted = rows.length < pageSize * 4;
  const matchesExhausted = filtered.length <= pageSize;
  if (windowExhausted && matchesExhausted) return { items, nextCursor: null };

  // Otherwise more matches may exist past the edge we reached. Resume after the
  // last *shown* match when matches were cut off, so the already-fetched rows
  // that followed it are scanned again on the next page rather than skipped;
  // resume after the last fetched row when the window itself was cut short.
  const anchor = filtered.length > pageSize ? filtered[pageSize - 1] : rows[rows.length - 1];
  return {
    items,
    nextCursor: encodeCursor({ createdAt: anchor.created_at, id: anchor.id }),
  };
}

function normalizeQuery(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().slice(0, 100);
}

export async function getArticle(slug: string): Promise<ArticleDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_codex_article", { p_slug: slug });
  if (error) return null;
  return (data?.[0] as ArticleDetail | undefined) ?? null;
}

export async function listArticleVersions(articleId: string): Promise<CodexVersion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_codex_versions", {
    p_article_id: articleId,
    p_limit: VERSION_PAGE_SIZE,
  });
  if (error) return [];
  return (data ?? []) as CodexVersion[];
}

export async function listOwnCodexBookmarks(
  options: { cursor?: string | null; pageSize?: number } = {},
): Promise<CodexPage<BookmarkSummary>> {
  const pageSize = boundedLimit(options.pageSize, CODEX_PAGE_SIZE, 50);
  const cursor = decodeCursor(options.cursor);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_own_codex_bookmarks", {
    p_cursor_created_at: cursor?.createdAt,
    p_cursor_id: cursor?.id,
    p_limit: pageSize,
  });

  if (error) return emptyPage();
  return toCodexPage(
    data,
    pageSize,
    (row) => row.bookmarked_at,
    (row) => row.bookmark_id,
  );
}

export async function listOwnCodexSuggestions(): Promise<OwnSuggestion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_own_codex_suggestions", {
    p_limit: 100,
  });
  if (error) return [];
  return (data ?? []) as OwnSuggestion[];
}

export async function listOwnCodexProposals(): Promise<OwnProposal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_own_codex_proposals", {
    p_limit: 100,
  });
  if (error) return [];
  return (data ?? []) as OwnProposal[];
}

export function parseSuggestionStatus(
  value: string | string[] | undefined,
): CodexSuggestionStatus | null {
  if (value === "all") return null;
  if (value === "open" || value === "accepted" || value === "rejected" || value === "merged") {
    return value;
  }
  return "open";
}

export function parseProposalStatus(
  value: string | string[] | undefined,
): CodexProposalStatus | null {
  const statuses = [
    "proposed",
    "classified",
    "drafting",
    "reviewed",
    "published",
    "rejected",
    "withdrawn",
    "reopened",
    "replaced",
  ] as const;
  if (value === "all") return null;
  return statuses.find((status) => status === value) ?? "proposed";
}

export interface SuggestionQueueOptions {
  status?: CodexSuggestionStatus | null;
  cursor?: string | null;
  pageSize?: number;
}

export interface ProposalQueueOptions {
  status?: CodexProposalStatus | null;
  cursor?: string | null;
  pageSize?: number;
}

export async function moderationListCodexSuggestions(
  options: SuggestionQueueOptions = {},
): Promise<CodexPage<SuggestionQueueRow>> {
  const pageSize = boundedLimit(options.pageSize, CODEX_QUEUE_PAGE_SIZE, 100);
  const cursor = decodeCursor(options.cursor);
  const status = options.status ?? "open";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("moderation_list_codex_suggestions", {
    p_status: status,
    p_cursor_created_at: cursor?.createdAt,
    p_cursor_id: cursor?.id,
    p_limit: pageSize,
  });

  if (error) return emptyPage();
  return toCodexPage(
    data,
    pageSize,
    (row) => row.created_at,
    (row) => row.suggestion_id,
  );
}

export async function moderationListCodexProposals(
  options: ProposalQueueOptions = {},
): Promise<CodexPage<ProposalQueueRow>> {
  const pageSize = boundedLimit(options.pageSize, CODEX_QUEUE_PAGE_SIZE, 100);
  const cursor = decodeCursor(options.cursor);
  const status = options.status ?? "proposed";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("moderation_list_codex_proposals", {
    p_status: status,
    p_cursor_created_at: cursor?.createdAt,
    p_cursor_id: cursor?.id,
    p_limit: pageSize,
  });

  if (error) return emptyPage();
  return toCodexPage(
    data,
    pageSize,
    (row) => row.created_at,
    (row) => row.proposal_id,
  );
}

export async function getProposal(proposalId: string): Promise<ProposalDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_codex_proposal", {
    p_proposal_id: proposalId,
  });
  if (error) return null;
  return (data?.[0] as ProposalDetail | undefined) ?? null;
}

export async function listProposalSources(proposalId: string): Promise<ProposalSource[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_codex_proposal_sources", {
    p_proposal_id: proposalId,
    p_limit: 100,
  });
  if (error) return [];
  return (data ?? []) as ProposalSource[];
}

export async function listProposalContributors(proposalId: string): Promise<ProposalContributor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_codex_proposal_contributors", {
    p_proposal_id: proposalId,
    p_limit: 100,
  });
  if (error) return [];
  return (data ?? []) as ProposalContributor[];
}

export interface ProvenanceViewer {
  userId: string | null;
  canEdit: boolean;
}

export interface ArticleProvenance {
  proposal: ProposalDetail;
  sources: ProposalSource[];
  contributors: ProposalContributor[];
}

const MAX_PROVENANCE_PROBES = 8;

/**
 * Resolve the proposals that produced an article, for a viewer who can read
 * them (the proposer or an Archivist).
 *
 * The contract has no article→proposal read RPC: `codex_proposals.article_id`
 * points one way, and `list_codex_proposal_sources` exposes only the labels the
 * viewer is allowed to open. This helper reconstructs the reverse link with a
 * bounded scan — the proposer's own list carries `article_id` directly, and an
 * Archivist probes at most `MAX_PROVENANCE_PROBES` published proposals — then
 * resolves each proposal's sources and contributors through the visibility
 * RPCs. A reader without either role gets no provenance at all.
 *
 * @returns `null` when the viewer cannot read proposals or nothing matched.
 */
export async function resolveArticleProvenance(
  articleId: string,
  viewer: ProvenanceViewer,
): Promise<ArticleProvenance[] | null> {
  if (!viewer.canEdit && !viewer.userId) return null;

  const candidateIds = new Set<string>();

  if (viewer.canEdit) {
    const queue = await moderationListCodexProposals({ status: "published", pageSize: 50 });
    for (const row of queue.items.slice(0, MAX_PROVENANCE_PROBES)) {
      const proposal = await getProposal(row.proposal_id);
      if (proposal && proposal.article_id === articleId) candidateIds.add(proposal.proposal_id);
    }
  }

  if (viewer.userId) {
    const own = await listOwnCodexProposals();
    for (const proposal of own) {
      if (proposal.article_id === articleId) candidateIds.add(proposal.proposal_id);
    }
  }

  if (candidateIds.size === 0) return null;

  const provenance: ArticleProvenance[] = [];
  for (const proposalId of candidateIds) {
    const proposal = await getProposal(proposalId);
    if (!proposal) continue;
    const [sources, contributors] = await Promise.all([
      listProposalSources(proposalId),
      listProposalContributors(proposalId),
    ]);
    provenance.push({ proposal, sources, contributors });
  }

  return provenance.length > 0 ? provenance : null;
}
