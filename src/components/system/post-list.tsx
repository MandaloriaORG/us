import Link from "next/link";
import { CaretRightIcon, PushPinSimpleIcon } from "@phosphor-icons/react/dist/ssr";

import type { PostSummary } from "@/lib/content/queries";
import { formatRelativeTime } from "@/lib/time";

import { AuthorMark } from "./author-mark";
import { PlazaChip } from "./plaza-chip";

export interface PostListProps {
  /** A page of posts, already ordered and paginated by the caller. */
  posts: PostSummary[];
  /** Show each row's Plaza name — for feeds spanning more than one Plaza. */
  showPlazaName?: boolean;
  /** Href for the next page; omit or pass null/undefined to hide the link. */
  nextHref?: string | null;
}

/**
 * Shared post-card list, extracted from `plazas/[slug]/page.tsx`.
 *
 * Responsibility: render one page of `PostSummary` cards (title, excerpt,
 * author, relative age, comment count, score) as a stacked card list. Each
 * post is an independent, selectable unit, so a card is the right container:
 * a raised surface with a hairline border that warms to the brand and lifts a
 * pixel on hover. Renders nothing for an empty array: the caller decides its
 * own empty state, since Plaza-scoped and cross-Plaza copy differ. `nextHref`
 * renders the same forward-only "Next" pagination link used by every other
 * post listing; do not add a page-count control, there is none to show.
 */
export function PostList({ posts, showPlazaName = false, nextHref }: PostListProps) {
  if (posts.length === 0) return null;

  return (
    <>
      <ol className="mt-4 flex flex-col gap-3">
        {posts.map((post) => (
          <li key={post.id}>
            <Link
              href={`/posts/${post.id}`}
              className="group border-border bg-bg-raised duration-fast hover:border-brand/45 focus-visible:ring-border-focus grid min-h-11 min-w-0 gap-1 rounded-lg border px-4 py-3.5 transition-all hover:-translate-y-px hover:shadow-lg focus-visible:ring-2 focus-visible:outline-hidden sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
            >
              <span className="min-w-0">
                <span className="text-fg duration-fast group-hover:text-brand font-display flex items-center gap-1.5 text-[0.95rem] leading-snug font-semibold transition-colors">
                  {post.is_pinned ? (
                    <PushPinSimpleIcon
                      aria-hidden="true"
                      className="text-brand h-3.5 w-3.5 shrink-0"
                    />
                  ) : null}
                  <span className="min-w-0">{post.title}</span>
                </span>
                {post.excerpt ? (
                  <span className="text-fg-muted mt-1 line-clamp-2 block text-sm">
                    {post.excerpt}
                  </span>
                ) : null}
                <span className="text-fg-subtle mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  {showPlazaName ? (
                    <PlazaChip slug={post.plaza_slug} name={post.plaza_name} />
                  ) : null}
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <AuthorMark name={post.author_display_name} />
                    <span className="truncate">{post.author_display_name}</span>
                  </span>
                  <span aria-hidden="true" className="text-fg-subtle/60">
                    ·
                  </span>
                  <time dateTime={post.created_at}>{formatRelativeTime(post.created_at)}</time>
                </span>
              </span>
              <span className="text-fg-subtle flex shrink-0 items-center gap-3 text-sm sm:justify-end">
                <span className="tabular-nums">
                  {post.comments_count} {post.comments_count === 1 ? "comment" : "comments"}
                </span>
                <span className="tabular-nums">
                  {post.score} {post.score === 1 ? "point" : "points"}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      {nextHref ? (
        <Link
          href={nextHref}
          className="group border-border bg-bg-raised text-fg-muted hover:text-fg hover:border-border-raised focus-visible:ring-border-focus mt-4 inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden active:scale-[0.98]"
        >
          Next
          <CaretRightIcon
            aria-hidden="true"
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      ) : null}
    </>
  );
}
