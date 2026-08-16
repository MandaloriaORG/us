import "server-only";

import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

/**
 * Search reads and their URL contract.
 *
 * The `search_content` RPC is the only surface: it is permission-aware inside
 * (deleted, hidden, quarantined and private content never appears), it applies
 * the plaza/tag/author filters, and it bounds its own page. This module only
 * parses the URL filters defensively, resolves the plaza slug to the id the RPC
 * wants, and normalizes the rows before a route renders them. A malformed URL
 * never reaches the database, and a database fault never leaks its message.
 */

type Functions = Database["public"]["Functions"];
export type SearchRow = Functions["search_content"]["Returns"][number];

export const SEARCH_PAGE_SIZE = 20;
/** The RPC refuses offsets above 100 000, so 5 000 pages is the ceiling. */
export const SEARCH_MAX_PAGE = Math.floor(100_000 / SEARCH_PAGE_SIZE);

export type SearchEntityType = "post" | "comment" | "article";
export const searchEntityTypes: readonly SearchEntityType[] = ["post", "comment", "article"];

export interface SearchFilterValues {
  author: string;
  page: string;
  plaza: string;
  q: string;
  tag: string;
  type: string;
}

export type SearchFilterField = "author" | "page" | "plaza" | "q" | "tag" | "type";

type SearchParamValue = string | string[] | undefined;

export interface SearchFilterSearchParams {
  author?: SearchParamValue;
  page?: SearchParamValue;
  plaza?: SearchParamValue;
  q?: SearchParamValue;
  tag?: SearchParamValue;
  type?: SearchParamValue;
}

export interface SearchPlazaOption {
  id: string;
  name: string;
  slug: string;
}

export interface SearchRpcArgs {
  p_author_id: string | undefined;
  p_entity_type: SearchEntityType | undefined;
  p_limit: number;
  p_offset: number;
  p_plaza_id: string | undefined;
  p_query: string;
  p_tag_slug: string | undefined;
}

interface IdleSearchFilters {
  kind: "idle";
  values: SearchFilterValues;
}

interface InvalidSearchFilters {
  errors: Partial<Record<SearchFilterField, string>>;
  kind: "invalid";
  values: SearchFilterValues;
}

export interface ValidSearchFilters {
  canonicalQuery: string;
  kind: "valid";
  page: number;
  plazaSlug: string;
  rpcArgs: SearchRpcArgs;
  values: SearchFilterValues;
}

export type SearchFilterResult = IdleSearchFilters | InvalidSearchFilters | ValidSearchFilters;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tagSlugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const entityTypeSet = new Set<string>(searchEntityTypes);

function firstValue(value: SearchParamValue) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function canonicalQuery(values: SearchFilterValues, page: number) {
  const params = new URLSearchParams();
  const query = values.q.trim();
  if (query) params.set("q", query);
  if (values.type) params.set("type", values.type);
  if (values.plaza) params.set("plaza", values.plaza);
  if (values.tag) params.set("tag", values.tag);
  if (values.author) params.set("author", values.author);
  if (page > 1) params.set("page", String(page));
  return params.toString();
}

/**
 * Parse the URL search state into a database call. A missing query is "idle":
 * the route renders the form and a hint instead of searching. Every filter is
 * validated before the RPC is reached, so a hand-edited URL degrades to a
 * readable message rather than a database error.
 */
export function parseSearchFilters(
  searchParams: SearchFilterSearchParams = {},
  plazas: ReadonlyArray<SearchPlazaOption> = [],
): SearchFilterResult {
  const values: SearchFilterValues = {
    author: firstValue(searchParams.author),
    page: firstValue(searchParams.page),
    plaza: firstValue(searchParams.plaza),
    q: firstValue(searchParams.q),
    tag: firstValue(searchParams.tag),
    type: firstValue(searchParams.type),
  };

  const query = values.q.trim().slice(0, 200);
  if (!query) {
    return { kind: "idle", values };
  }

  const errors: Partial<Record<SearchFilterField, string>> = {};

  if (values.q.length > 200) {
    errors.q = "Keep the search query to 200 characters or fewer.";
  }

  let entityType: SearchEntityType | undefined;
  if (values.type) {
    entityType = entityTypeSet.has(values.type) ? (values.type as SearchEntityType) : undefined;
    if (!entityType) {
      errors.type = "Choose posts, comments or articles.";
    }
  }

  const plaza = plazas.find((candidate) => candidate.slug === values.plaza);
  if (values.plaza && !plaza) {
    errors.plaza = "Choose a visible Plaza.";
  }

  const tag = values.tag ? values.tag.trim().toLowerCase().slice(0, 32) : undefined;
  if (values.tag) {
    if (tag!.length < 2) {
      errors.tag = "Tags are at least 2 characters.";
    } else if (!tagSlugPattern.test(tag!)) {
      errors.tag = "Use lowercase words separated by hyphens.";
    }
  }

  const authorId =
    values.author && uuidPattern.test(values.author) ? values.author.toLowerCase() : undefined;
  if (values.author && !authorId) {
    errors.author = "Enter a valid author ID.";
  }

  let page = 1;
  if (values.page) {
    if (!/^[1-9]\d*$/.test(values.page)) {
      errors.page = `Enter a whole page number from 1 to ${SEARCH_MAX_PAGE}.`;
    } else {
      const parsedPage = Number(values.page);
      if (!Number.isSafeInteger(parsedPage) || parsedPage > SEARCH_MAX_PAGE) {
        errors.page = `Enter a whole page number from 1 to ${SEARCH_MAX_PAGE}.`;
      } else {
        page = parsedPage;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors, kind: "invalid", values };
  }

  return {
    canonicalQuery: canonicalQuery(values, page),
    kind: "valid",
    page,
    plazaSlug: plaza?.slug ?? "",
    rpcArgs: {
      p_author_id: authorId,
      p_entity_type: entityType,
      p_limit: SEARCH_PAGE_SIZE + 1,
      p_offset: (page - 1) * SEARCH_PAGE_SIZE,
      p_plaza_id: plaza?.id,
      p_query: query,
      p_tag_slug: tag,
    },
    values,
  };
}

export function searchHref(canonicalQuery: string, page: number) {
  const params = new URLSearchParams(canonicalQuery);

  if (page > 1) {
    params.set("page", String(page));
  } else {
    params.delete("page");
  }

  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}

export interface SearchResult {
  authorDisplayName: string;
  authorId: string;
  createdAt: string;
  entityId: string;
  entityType: SearchEntityType;
  excerpt: string | null;
  plazaId: string | null;
  plazaSlug: string | null;
  title: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, maximumLength: number, minimumLength = 1) {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return normalized.length >= minimumLength && normalized.length <= maximumLength
    ? normalized
    : null;
}

function normalizeUuid(value: unknown) {
  return typeof value === "string" && uuidPattern.test(value) ? value : null;
}

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "string") return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeEntityType(value: unknown): SearchEntityType | null {
  return typeof value === "string" && entityTypeSet.has(value) ? (value as SearchEntityType) : null;
}

function normalizeSearchRow(value: unknown): SearchResult | null {
  if (!isRecord(value)) return null;

  const entityId = normalizeUuid(value.entity_id);
  const entityType = normalizeEntityType(value.entity_type);
  const authorId = normalizeUuid(value.author_id);
  const createdAt = normalizeTimestamp(value.created_at);
  const title = boundedText(value.title, 300);

  if (!entityId || !entityType || !authorId || !createdAt || !title) {
    return null;
  }

  // Articles carry no plaza; posts and comments always do. A malformed plaza on
  // a post/comment row means the row cannot be rendered safely, so it is dropped.
  const plazaId = value.plaza_id === null ? null : normalizeUuid(value.plaza_id);
  if (plazaId === null && value.plaza_id !== null) return null;

  const plazaSlug =
    typeof value.plaza_slug === "string" && value.plaza_slug.length <= 48 ? value.plaza_slug : null;
  if (plazaSlug === null && typeof value.plaza_slug === "string") return null;

  return {
    authorDisplayName: boundedText(value.author_display_name, 50) ?? "Deleted member",
    authorId,
    createdAt,
    entityId,
    entityType,
    excerpt: boundedText(value.excerpt, 280),
    plazaId,
    plazaSlug,
    title,
  };
}

export function normalizeSearchRows(value: unknown): SearchResult[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, SEARCH_PAGE_SIZE + 1).flatMap((row) => {
    const normalized = normalizeSearchRow(row);
    return normalized ? [normalized] : [];
  });
}

export interface SearchOutcome {
  items: SearchResult[];
  /** A full page implies a next page; the last result row carries no total. */
  hasNext: boolean;
}

/**
 * Run one search page through the RPC. The route treats a database failure as
 * an error page rather than an empty state, so this throws instead of hiding
 * the fault.
 */
export async function searchContent(filters: ValidSearchFilters): Promise<SearchOutcome> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_content", filters.rpcArgs);

  if (error) {
    throw new Error("Search results could not be loaded");
  }

  const items = normalizeSearchRows(data);
  return { items, hasNext: items.length > SEARCH_PAGE_SIZE };
}
