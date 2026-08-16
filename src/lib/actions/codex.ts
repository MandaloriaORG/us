"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getArticle } from "@/lib/codex/queries";
import { isValidSlug, slugify } from "@/lib/codex/slug";
import type { Database } from "@/lib/database.types";

/**
 * Write paths for Codex Libre.
 *
 * Authority is never decided here. Every mutation calls an RPC that re-checks
 * the actor, the permission, the target's state, source visibility and the rate
 * limit inside the database transaction; this module validates shape, maps
 * database error codes onto stable result codes, and refreshes the affected
 * routes. A client that skips these actions and calls the RPC directly gets
 * exactly the same answer.
 *
 * Reasons are mandatory for the transitions that must survive the person who
 * made them (unpublish, archive, lock, restore, reject, withdraw, assign) —
 * the database enforces that too, through `private.validated_reason`.
 */

type Enums = Database["public"]["Enums"];

const uuidSchema = z.string().uuid();
const reasonSchema = z
  .string()
  .trim()
  .min(3, "A reason must be at least 3 characters")
  .max(500, "A reason must be at most 500 characters");

const articleStatusSchema = z.enum(["draft", "published", "unpublished", "archived", "locked"]);

const proposalStatusSchema = z.enum([
  "proposed",
  "classified",
  "drafting",
  "reviewed",
  "published",
  "rejected",
  "withdrawn",
  "reopened",
  "replaced",
]);

const contributionStatusSchema = z.enum(["proposed", "confirmed", "rejected", "withdrawn"]);

const contributionTypeSchema = z.enum([
  "question",
  "explanation",
  "evidence",
  "synthesis",
  "review",
  "edit",
]);

const attributionSchema = z.enum(["public", "anonymous", "withdrawn"]);

const titleSchema = z
  .string({ invalid_type_error: "Enter a title" })
  .transform((value) => value.normalize("NFKC").trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(3, "Title must be at least 3 characters")
      .max(300, "Title must be at most 300 characters"),
  );

/**
 * Control characters are stripped and newlines normalised, but Markdown is left
 * intact: it is stored as written and sanitised when it is rendered, so the
 * source an Archivist can edit is the source they typed.
 */
function longBodySchema(max: number, label: string) {
  return z
    .string({ invalid_type_error: `Enter ${label}` })
    .max(max + 1000, `${label} is too long`)
    .transform((value) =>
      value
        .normalize("NFKC")
        .replace(/\r\n?/g, "\n")
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
        .trim(),
    )
    .pipe(
      z
        .string()
        .min(1, `${label} cannot be empty`)
        .max(max, `${label} must be at most ${max} characters`),
    );
}

const bodySchema = longBodySchema(100_000, "Article body");
const excerptSchema = z
  .string()
  .transform((value) => value.normalize("NFKC").trim())
  .pipe(
    z
      .string()
      .max(500, "Excerpt must be at most 500 characters")
      .refine(
        (value) => value === "" || value.length >= 3,
        "Excerpt must be at least 3 characters",
      ),
  )
  .transform((value) => (value === "" ? null : value));

const changeSummarySchema = z
  .string()
  .transform((value) => value.normalize("NFKC").trim())
  .pipe(
    z
      .string()
      .max(500, "A change summary must be at most 500 characters")
      .refine(
        (value) => value === "" || value.length >= 3,
        "A change summary must be at least 3 characters",
      ),
  )
  .transform((value) => (value === "" ? null : value));

const createArticleSchema = z.object({
  categorySlug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Pick a category"),
  title: titleSchema,
  body: bodySchema,
  excerpt: excerptSchema.optional().default(""),
  slug: z
    .string()
    .transform((value) => value.normalize("NFKC").trim().toLowerCase())
    .pipe(
      z
        .string()
        .max(80, "Slug must be at most 80 characters")
        .refine(
          (value) => value === "" || isValidSlug(value),
          "Use lowercase words separated by hyphens",
        ),
    )
    .optional()
    .default(""),
});

const updateArticleSchema = z.object({
  articleId: uuidSchema,
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  title: titleSchema,
  body: bodySchema,
  excerpt: excerptSchema.optional().default(""),
  changeSummary: changeSummarySchema.optional().default(""),
});

const publishArticleSchema = z.object({
  articleId: uuidSchema,
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  expectedStatus: articleStatusSchema,
  changeSummary: changeSummarySchema.optional().default(""),
});

const setArticleStatusSchema = z.object({
  articleId: uuidSchema,
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  expectedStatus: articleStatusSchema,
  status: z.enum(["published", "unpublished", "archived", "locked"]),
  reason: reasonSchema,
});

const restoreVersionSchema = z.object({
  articleId: uuidSchema,
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  version: z.number().int().positive(),
  reason: reasonSchema,
});

const suggestionSchema = z.object({
  articleId: uuidSchema,
  body: z
    .string()
    .transform((value) => value.normalize("NFKC").trim())
    .pipe(
      z
        .string()
        .min(10, "A suggestion must be at least 10 characters")
        .max(2000, "A suggestion must be at most 2000 characters"),
    ),
});

const reviewSuggestionSchema = z.object({
  suggestionId: uuidSchema,
  expectedStatus: z.enum(["open", "accepted", "rejected", "merged"]),
  status: z.enum(["accepted", "rejected", "merged"]),
  reviewNote: reasonSchema,
});

const proposalSourceSchema = z.union([
  z.object({
    postId: uuidSchema,
    commentId: z.never().optional(),
    externalUrl: z.never().optional(),
  }),
  z.object({
    commentId: uuidSchema,
    postId: z.never().optional(),
    externalUrl: z.never().optional(),
  }),
  z.object({
    externalUrl: z
      .string()
      .trim()
      .regex(/^https?:\/\/\S+$/, "Enter a valid http(s) URL"),
    postId: z.never().optional(),
    commentId: z.never().optional(),
  }),
]);

const createProposalSchema = z.object({
  reason: z
    .string()
    .transform((value) => value.normalize("NFKC").trim())
    .pipe(
      z
        .string()
        .min(20, "A reason must be at least 20 characters")
        .max(2000, "A reason must be at most 2000 characters"),
    ),
  workingTitle: z
    .string()
    .transform((value) => value.normalize("NFKC").trim())
    .pipe(
      z
        .string()
        .max(300, "A working title must be at most 300 characters")
        .refine(
          (value) => value === "" || value.length >= 3,
          "A working title must be at least 3 characters",
        ),
    )
    .optional()
    .default(""),
  source: proposalSourceSchema,
});

const addSourceSchema = z.object({
  proposalId: uuidSchema,
  note: z
    .string()
    .transform((value) => value.normalize("NFKC").trim())
    .pipe(z.string().max(500, "A note must be at most 500 characters"))
    .optional()
    .default(""),
  source: proposalSourceSchema,
});

const removeSourceSchema = z.object({
  proposalId: uuidSchema,
  sourceId: uuidSchema,
});

const upsertContributorSchema = z.object({
  proposalId: uuidSchema,
  memberId: uuidSchema,
  contributionType: contributionTypeSchema,
  attribution: attributionSchema.optional().default("public"),
  evidenceRef: z
    .string()
    .transform((value) => value.normalize("NFKC").trim())
    .pipe(z.string().max(500, "An evidence reference must be at most 500 characters"))
    .optional()
    .default(""),
});

const setContributorStatusSchema = z.object({
  proposalId: uuidSchema,
  memberId: uuidSchema,
  expectedStatus: contributionStatusSchema,
  status: contributionStatusSchema,
  reason: reasonSchema,
});

const assignProposalSchema = z.object({
  proposalId: uuidSchema,
  assigneeId: uuidSchema,
  reason: reasonSchema,
});

const updateProposalStatusSchema = z.object({
  proposalId: uuidSchema,
  expectedStatus: proposalStatusSchema,
  status: proposalStatusSchema,
  reason: z.string().trim().max(500).optional().default(""),
});

const publishProposalSchema = z.object({
  proposalId: uuidSchema,
  expectedStatus: proposalStatusSchema,
  articleSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
});

const replaceProposalSchema = z.object({
  proposalId: uuidSchema,
  replacedBy: uuidSchema,
  reason: reasonSchema,
});

const upsertCategorySchema = z.object({
  slug: z
    .string()
    .transform((value) => value.normalize("NFKC").trim().toLowerCase())
    .pipe(
      z
        .string()
        .min(2, "Slug must be at least 2 characters")
        .max(48, "Slug must be at most 48 characters")
        .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens"),
    ),
  name: z
    .string()
    .transform((value) => value.normalize("NFKC").trim())
    .pipe(
      z
        .string()
        .min(2, "Name must be at least 2 characters")
        .max(80, "Name must be at most 80 characters"),
    ),
  description: z
    .string()
    .transform((value) => value.normalize("NFKC").trim())
    .pipe(z.string().max(500, "Description must be at most 500 characters"))
    .optional()
    .default(""),
  sortOrder: z.number().int().optional().default(0),
});

export type CodexActionResult<T = object> =
  | ({ ok: true } & T)
  | {
      ok: false;
      code:
        | "access_denied"
        | "invalid_input"
        | "invalid_request"
        | "not_found"
        | "rate_limited"
        | "already_exists"
        | "stale"
        | "retry";
      message: string;
      /** Field-level messages, present only when validation rejected the input. */
      fieldErrors?: Record<string, string>;
    };

const RETRY_RESULT: CodexActionResult<never> = {
  ok: false,
  code: "retry",
  message: "The change could not be saved. Try again.",
};

function invalidInput(error: z.ZodError): CodexActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }

  return {
    ok: false,
    code: "invalid_input",
    message: "Check the highlighted fields and try again.",
    fieldErrors,
  };
}

function databaseErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

function databaseFailure(error: unknown): CodexActionResult<never> {
  switch (databaseErrorCode(error)) {
    case "42501":
      return {
        ok: false,
        code: "access_denied",
        message: "You do not have permission to do this.",
      };
    case "P0002":
      return {
        ok: false,
        code: "not_found",
        message: "That content is no longer available.",
      };
    case "22023":
      return {
        ok: false,
        code: "invalid_request",
        message: "This change is not valid for the current state.",
      };
    case "53400":
      return {
        ok: false,
        code: "rate_limited",
        message: "You have done that too many times. Wait a moment and try again.",
      };
    case "40001":
      return {
        ok: false,
        code: "stale",
        message: "This content changed since you read it. Refresh and try again.",
      };
    case "23505":
      return {
        ok: false,
        code: "already_exists",
        message: "That already exists. Choose a different value.",
      };
    default:
      return RETRY_RESULT;
  }
}

function refresh(paths: string[]) {
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      // The mutation is already committed; a cache fault must not invite a retry.
    }
  }
}

function articlePaths(slug: string) {
  return ["/codex", `/codex/${slug}`, `/council/codex/${slug}/edit`];
}

// ── Articles ────────────────────────────────────────────────────────────────

export async function createArticle(
  input: unknown,
): Promise<CodexActionResult<{ articleId: string; slug: string }>> {
  const parsed = createArticleSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const resolvedSlug = parsed.data.slug || slugify(parsed.data.title);
  if (!isValidSlug(resolvedSlug)) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Check the highlighted fields and try again.",
      fieldErrors: { slug: "Choose a slug for this title" },
    };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_codex_article", {
      p_category_slug: parsed.data.categorySlug,
      p_title: parsed.data.title,
      p_body: parsed.data.body,
      p_excerpt: parsed.data.excerpt ?? undefined,
      p_slug: resolvedSlug,
    });

    if (error) return databaseFailure(error);

    const articleId = data?.[0]?.article_id;
    if (!articleId) return RETRY_RESULT;

    refresh(["/codex", `/council/codex/${resolvedSlug}/edit`]);
    return { ok: true, articleId, slug: resolvedSlug };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function updateArticle(input: unknown): Promise<CodexActionResult> {
  const parsed = updateArticleSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_codex_article", {
      p_article_id: parsed.data.articleId,
      p_title: parsed.data.title,
      p_body: parsed.data.body,
      p_excerpt: parsed.data.excerpt ?? undefined,
      p_change_summary: parsed.data.changeSummary ?? undefined,
    });

    if (error) return databaseFailure(error);

    refresh(articlePaths(parsed.data.slug));
    return { ok: true };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function publishArticle(input: unknown): Promise<CodexActionResult> {
  const parsed = publishArticleSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("publish_codex_article", {
      p_article_id: parsed.data.articleId,
      p_expected_status: parsed.data.expectedStatus,
      p_change_summary: parsed.data.changeSummary ?? undefined,
    });

    if (error) return databaseFailure(error);

    refresh(articlePaths(parsed.data.slug));
    return { ok: true };
  } catch (error) {
    return databaseFailure(error);
  }
}

/** Unpublish, archive, lock, or restore-to-published — all require a reason. */
export async function setArticleStatus(
  input: unknown,
): Promise<CodexActionResult<{ status: Enums["codex_article_status"] }>> {
  const parsed = setArticleStatusSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_codex_article_status", {
      p_article_id: parsed.data.articleId,
      p_expected_status: parsed.data.expectedStatus,
      p_status: parsed.data.status,
      p_reason: parsed.data.reason,
    });

    if (error) return databaseFailure(error);

    refresh(articlePaths(parsed.data.slug));
    return { ok: true, status: parsed.data.status };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function restoreArticleVersion(input: unknown): Promise<CodexActionResult> {
  const parsed = restoreVersionSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("restore_codex_version", {
      p_article_id: parsed.data.articleId,
      p_version: parsed.data.version,
      p_reason: parsed.data.reason,
    });

    if (error) return databaseFailure(error);

    refresh(articlePaths(parsed.data.slug));
    return { ok: true };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function toggleBookmark(
  articleId: unknown,
): Promise<CodexActionResult<{ bookmarked: boolean }>> {
  const parsed = uuidSchema.safeParse(articleId);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("toggle_codex_bookmark", {
      p_article_id: parsed.data,
    });

    if (error) return databaseFailure(error);

    const row = data?.[0];
    if (!row) return RETRY_RESULT;

    refresh(["/codex/bookmarks"]);
    return { ok: true, bookmarked: row.bookmarked };
  } catch (error) {
    return databaseFailure(error);
  }
}

// ── Suggestions ─────────────────────────────────────────────────────────────

export async function createSuggestion(
  input: unknown,
): Promise<CodexActionResult<{ suggestionId: string }>> {
  const parsed = suggestionSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_codex_suggestion", {
      p_article_id: parsed.data.articleId,
      p_body: parsed.data.body,
    });

    if (error) return databaseFailure(error);

    const suggestionId = data?.[0]?.suggestion_id;
    if (!suggestionId) return RETRY_RESULT;

    return { ok: true, suggestionId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function reviewSuggestion(
  input: unknown,
): Promise<CodexActionResult<{ status: Enums["codex_suggestion_status"] }>> {
  const parsed = reviewSuggestionSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("review_codex_suggestion", {
      p_suggestion_id: parsed.data.suggestionId,
      p_expected_status: parsed.data.expectedStatus,
      p_status: parsed.data.status,
      p_review_note: parsed.data.reviewNote,
    });

    if (error) return databaseFailure(error);

    refresh(["/council/codex/suggestions", "/council/codex"]);
    return { ok: true, status: parsed.data.status };
  } catch (error) {
    return databaseFailure(error);
  }
}

// ── Proposals ───────────────────────────────────────────────────────────────

export async function createProposal(
  input: unknown,
): Promise<CodexActionResult<{ proposalId: string }>> {
  const parsed = createProposalSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_codex_proposal", {
      p_reason: parsed.data.reason,
      p_working_title: parsed.data.workingTitle || undefined,
      p_post_id: parsed.data.source.postId,
      p_comment_id: parsed.data.source.commentId,
      p_external_url: parsed.data.source.externalUrl,
    });

    if (error) return databaseFailure(error);

    const proposalId = data?.[0]?.proposal_id;
    if (!proposalId) return RETRY_RESULT;

    refresh(["/codex/proposals"]);
    return { ok: true, proposalId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function addProposalSource(
  input: unknown,
): Promise<CodexActionResult<{ sourceId: string }>> {
  const parsed = addSourceSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("add_codex_proposal_source", {
      p_proposal_id: parsed.data.proposalId,
      p_source_type: sourceType(parsed.data.source),
      p_post_id: parsed.data.source.postId,
      p_comment_id: parsed.data.source.commentId,
      p_external_url: parsed.data.source.externalUrl,
      p_note: parsed.data.note || undefined,
    });

    if (error) return databaseFailure(error);

    const sourceId = data?.[0]?.source_id;
    if (!sourceId) return RETRY_RESULT;

    refresh([`/codex/proposals/${parsed.data.proposalId}`]);
    return { ok: true, sourceId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function removeProposalSource(
  input: unknown,
): Promise<CodexActionResult<{ sourceId: string }>> {
  const parsed = removeSourceSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("remove_codex_proposal_source", {
      p_proposal_id: parsed.data.proposalId,
      p_source_id: parsed.data.sourceId,
    });

    if (error) return databaseFailure(error);

    refresh([`/codex/proposals/${parsed.data.proposalId}`]);
    return { ok: true, sourceId: parsed.data.sourceId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function upsertProposalContributor(
  input: unknown,
): Promise<CodexActionResult<{ contributorId: string }>> {
  const parsed = upsertContributorSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("upsert_codex_proposal_contributor", {
      p_proposal_id: parsed.data.proposalId,
      p_member_id: parsed.data.memberId,
      p_contribution_type: parsed.data.contributionType,
      p_attribution: parsed.data.attribution,
      p_evidence_ref: parsed.data.evidenceRef || undefined,
    });

    if (error) return databaseFailure(error);

    const contributorId = data?.[0]?.contributor_id;
    if (!contributorId) return RETRY_RESULT;

    refresh([`/codex/proposals/${parsed.data.proposalId}`]);
    return { ok: true, contributorId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function setProposalContributorStatus(
  input: unknown,
): Promise<CodexActionResult<{ status: Enums["codex_contribution_status"] }>> {
  const parsed = setContributorStatusSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_codex_proposal_contributor_status", {
      p_proposal_id: parsed.data.proposalId,
      p_member_id: parsed.data.memberId,
      p_expected_status: parsed.data.expectedStatus,
      p_status: parsed.data.status,
      p_reason: parsed.data.reason,
    });

    if (error) return databaseFailure(error);

    refresh([`/codex/proposals/${parsed.data.proposalId}`]);
    return { ok: true, status: parsed.data.status };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function assignProposal(
  input: unknown,
): Promise<CodexActionResult<{ assigneeId: string }>> {
  const parsed = assignProposalSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("assign_codex_proposal", {
      p_proposal_id: parsed.data.proposalId,
      p_assignee_id: parsed.data.assigneeId,
      p_reason: parsed.data.reason,
    });

    if (error) return databaseFailure(error);

    refresh([`/codex/proposals/${parsed.data.proposalId}`, "/council/codex/proposals"]);
    return { ok: true, assigneeId: parsed.data.assigneeId };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function updateProposalStatus(
  input: unknown,
): Promise<CodexActionResult<{ status: Enums["codex_proposal_status"] }>> {
  const parsed = updateProposalStatusSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_codex_proposal_status", {
      p_proposal_id: parsed.data.proposalId,
      p_expected_status: parsed.data.expectedStatus,
      p_status: parsed.data.status,
      p_reason: parsed.data.reason || undefined,
    });

    if (error) return databaseFailure(error);

    refresh([`/codex/proposals/${parsed.data.proposalId}`, "/council/codex/proposals"]);
    return { ok: true, status: parsed.data.status };
  } catch (error) {
    return databaseFailure(error);
  }
}

/**
 * Publishing a proposal requires the reviewed article's id. The Archivist works
 * with slugs, so this action resolves the slug to the id first and then runs
 * the same compare-and-swap publish the workbench would.
 */
export async function publishProposalWithArticle(
  input: unknown,
): Promise<CodexActionResult<{ status: "published" }>> {
  const parsed = publishProposalSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const article = await getArticle(parsed.data.articleSlug);
    if (!article) {
      return {
        ok: false,
        code: "not_found",
        message: "That article does not exist or is not visible to you.",
      };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("update_codex_proposal_status", {
      p_proposal_id: parsed.data.proposalId,
      p_expected_status: parsed.data.expectedStatus,
      p_status: "published",
      p_article_id: article.id,
    });

    if (error) return databaseFailure(error);

    refresh([
      `/codex/proposals/${parsed.data.proposalId}`,
      "/council/codex/proposals",
      `/codex/${parsed.data.articleSlug}`,
    ]);
    return { ok: true, status: "published" };
  } catch (error) {
    return databaseFailure(error);
  }
}

export async function replaceProposal(
  input: unknown,
): Promise<CodexActionResult<{ replacedBy: string }>> {
  const parsed = replaceProposalSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("replace_codex_proposal", {
      p_proposal_id: parsed.data.proposalId,
      p_replaced_by: parsed.data.replacedBy,
      p_reason: parsed.data.reason,
    });

    if (error) return databaseFailure(error);

    refresh([`/codex/proposals/${parsed.data.proposalId}`, "/council/codex/proposals"]);
    return { ok: true, replacedBy: parsed.data.replacedBy };
  } catch (error) {
    return databaseFailure(error);
  }
}

// ── Categories ──────────────────────────────────────────────────────────────

export async function upsertCategory(input: unknown): Promise<CodexActionResult<{ slug: string }>> {
  const parsed = upsertCategorySchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_upsert_codex_category", {
      p_slug: parsed.data.slug,
      p_name: parsed.data.name,
      p_description: parsed.data.description || undefined,
      p_sort_order: parsed.data.sortOrder,
    });

    if (error) return databaseFailure(error);

    const slug = data?.[0]?.category_slug;
    if (!slug) return RETRY_RESULT;

    refresh(["/codex", "/council/codex"]);
    return { ok: true, slug };
  } catch (error) {
    return databaseFailure(error);
  }
}

const setCategoryStatusSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  expectedStatus: z.enum(["active", "archived"]),
  status: z.enum(["active", "archived"]),
  reason: reasonSchema,
});

/** Archive or reactivate a category; both directions carry a reason. */
export async function setCategoryStatus(
  input: unknown,
): Promise<CodexActionResult<{ status: "active" | "archived" }>> {
  const parsed = setCategoryStatusSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_set_codex_category_status", {
      p_slug: parsed.data.slug,
      p_expected_status: parsed.data.expectedStatus,
      p_status: parsed.data.status,
      p_reason: parsed.data.reason,
    });

    if (error) return databaseFailure(error);

    refresh(["/codex", "/council/codex"]);
    return { ok: true, status: parsed.data.status };
  } catch (error) {
    return databaseFailure(error);
  }
}

function sourceType(source: {
  postId?: string;
  commentId?: string;
  externalUrl?: string;
}): "post" | "comment" | "external" {
  if (source.postId) return "post";
  if (source.commentId) return "comment";
  return "external";
}
