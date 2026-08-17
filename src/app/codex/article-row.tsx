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
    <li className="group py-5">
      <div className="flex items-start gap-3.5">
        <span className="border-brand/25 bg-brand/5 text-brand-deep mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border shadow-[0_1px_0_var(--color-white/6%)] transition-colors duration-fast group-hover:border-brand/40 group-hover:bg-brand/10">
          <Article aria-hidden="true" className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <Link
            href={href ?? `/codex/${article.slug}`}
            className="text-fg font-display text-base font-semibold tracking-tight underline-offset-4 transition-colors duration-fast group-hover:text-brand focus-visible:ring-border-focus focus-visible:ring-2 focus-visible:outline-hidden"
          >
            {article.title}
          </Link>
          {article.excerpt ? (
            <p className="text-fg-muted mt-1 text-sm leading-6">{article.excerpt}</p>
          ) : null}
          <p className="text-fg-subtle mt-1.5 text-xs">{meta}</p>
        </div>
        {article.version > 1 ? (
          <span className="text-brand/70 shrink-0 rounded-full border border-brand/20 bg-brand/5 px-2 py-0.5 text-[11px] font-medium tabular-nums">
            v{article.version}
          </span>
        ) : null}
      </div>
    </li>
  );
}
