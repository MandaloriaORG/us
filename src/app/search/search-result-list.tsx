import Link from "next/link";

import { Badge } from "@/components/origin/badge";
import { formatRelativeTime } from "@/lib/time";
import type { SearchResult } from "@/lib/search";

const entityLabels: Readonly<Record<string, string>> = {
  article: "Article",
  comment: "Comment",
  post: "Post",
};

const META_LINK_CLASS =
  "duration-fast text-fg-muted hover:text-fg focus-visible:ring-border-focus rounded-xs underline-offset-4 transition-colors hover:underline focus-visible:ring-2 focus-visible:outline-hidden";

export interface SearchResultListProps {
  items: SearchResult[];
  /** Plaza slug → display name, so rows do not need a second read. */
  plazaNames: Readonly<Record<string, string>>;
}

/**
 * One page of search rows. Posts link to the post, articles link to the Codex
 * article, and a comment row links to the Plaza it lives in because the search
 * contract does not return the comment's post id — the row still names the post
 * in its title so the context survives. Renders nothing for an empty page; the
 * route owns its empty state.
 */
export function SearchResultList({ items, plazaNames }: SearchResultListProps) {
  return (
    <ol className="border-border mt-4 border-b">
      {items.map((item) => (
        <li key={`${item.entityType}:${item.entityId}`} className="border-border border-t py-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge size="sm" variant="outline">
              {entityLabels[item.entityType]}
            </Badge>
            {item.entityType === "comment" ? (
              <span className="text-fg min-w-0 font-medium">{item.title}</span>
            ) : (
              <Link
                className="text-fg duration-fast hover:text-brand focus-visible:ring-border-focus min-w-0 rounded-xs font-medium transition-colors hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
                href={
                  item.entityType === "post" ? `/posts/${item.entityId}` : `/codex/${item.entityId}`
                }
              >
                {item.title}
              </Link>
            )}
          </div>

          {item.excerpt ? (
            <p className="text-fg-muted mt-1 line-clamp-2 text-sm">{item.excerpt}</p>
          ) : null}

          <p className="text-fg-subtle mt-1 text-xs">
            {item.entityType !== "article" && item.plazaSlug ? (
              <>
                <Link className={META_LINK_CLASS} href={`/plazas/${item.plazaSlug}`}>
                  {item.entityType === "comment"
                    ? `In ${plazaName(plazaNames, item)}`
                    : plazaName(plazaNames, item)}
                </Link>
                {" · "}
              </>
            ) : null}
            {item.authorDisplayName}
            {" · "}
            {formatRelativeTime(item.createdAt)}
          </p>
        </li>
      ))}
    </ol>
  );
}

function plazaName(plazaNames: Readonly<Record<string, string>>, item: SearchResult) {
  return item.plazaSlug ? (plazaNames[item.plazaSlug] ?? item.plazaSlug) : "";
}
