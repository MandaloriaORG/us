import Link from "next/link";
import { Article } from "@phosphor-icons/react/dist/ssr";

import type { ArticleSummary } from "@/lib/codex/queries";

export function ArticleRow({
  article,
  meta,
  href,
}: {
  article: ArticleSummary;
  meta: string;
  /** Overrides the public article link; the Council dashboard links to its editor. */
  href?: string;
}) {
  return (
    <li className="py-4">
      <div className="flex items-start gap-3">
        <Article aria-hidden="true" className="text-fg-subtle mt-1 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <Link
            href={href ?? `/codex/${article.slug}`}
            className="text-fg hover:text-brand focus-visible:ring-border-focus font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
          >
            {article.title}
          </Link>
          {article.excerpt ? <p className="text-fg-muted mt-1 text-sm">{article.excerpt}</p> : null}
          <p className="text-fg-subtle mt-1 text-xs">{meta}</p>
        </div>
        {article.version > 1 ? (
          <span className="text-fg-subtle shrink-0 text-xs tabular-nums">v{article.version}</span>
        ) : null}
      </div>
    </li>
  );
}
