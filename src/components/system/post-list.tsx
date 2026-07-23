import Link from "next/link";

import type { PostSummary } from "@/lib/content/queries";
import { formatRelativeTime } from "@/lib/time";

export interface PostListProps {
  /** A page of posts, already ordered and paginated by the caller. */
  posts: PostSummary[];
  /** Show each row's Plaza name — for feeds spanning more than one Plaza. */
  showPlazaName?: boolean;
  /** Href for the next page; omit or pass null/undefined to hide the link. */
  nextHref?: string | null;
}

/**
 * Shared post-row list, extracted from `plazas/[slug]/page.tsx`.
 *
 * Responsibility: render one page of `PostSummary` rows (title, excerpt,
 * author, relative age, comment count, score) as a single continuous list —
 * the same row pattern already used in `marketing/capability-list` and the
 * Plaza directory. Renders nothing for an empty array: the caller decides its
 * own empty state, since Plaza-scoped and cross-Plaza copy differ. `nextHref`
 * renders the same forward-only "Next" pagination link used by every other
 * post listing; do not add a page-count control, there is none to show.
 */
export function PostList({ posts, showPlazaName = false, nextHref }: PostListProps) {
  if (posts.length === 0) return null;

  return (
    <>
      <ol className="border-border mt-2 border-b">
        {posts.map((post) => (
          <li key={post.id} className="border-border border-t">
            <Link
              href={`/posts/${post.id}`}
              className="group duration-fast hover:bg-surface focus-visible:bg-surface focus-visible:ring-border-focus grid min-h-11 min-w-0 gap-1 py-4 transition-colors focus-visible:ring-2 focus-visible:outline-hidden sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-4"
            >
              <span className="min-w-0">
                <span className="text-fg duration-fast group-hover:text-brand block font-medium transition-colors">
                  {post.title}
                </span>
                {post.excerpt ? (
                  <span className="text-fg-muted mt-0.5 line-clamp-2 block text-sm">
                    {post.excerpt}
                  </span>
                ) : null}
                <span className="text-fg-subtle mt-1 block text-xs">
                  {showPlazaName ? `${post.plaza_name} · ` : ""}
                  {post.author_display_name} · {formatRelativeTime(post.created_at)}
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
          className="text-brand mt-4 inline-block text-sm underline-offset-4 hover:underline"
        >
          Next
        </Link>
      ) : null}
    </>
  );
}
