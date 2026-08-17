import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PencilSimpleIcon, LockSimpleIcon } from "@phosphor-icons/react/dist/ssr";

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/origin/badge";
import { Button } from "@/components/ui/button";
import { CopyLinkButton } from "@/components/system/copy-link-button";
import { BookmarkButton } from "@/app/codex/bookmark-button";
import { SuggestionForm } from "@/app/codex/suggestion-form";
import { ProvenancePanel } from "@/app/codex/provenance-panel";
import { ARTICLE_STATUS_LABELS } from "@/lib/codex/states";
import { getArticle, resolveArticleProvenance } from "@/lib/codex/queries";
import { renderMarkdown } from "@/lib/content/markdown";
import { formatRelativeTime } from "@/lib/time";

export const dynamic = "force-dynamic";

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "Article not found" };
  const isPublic = article.status === "published" || article.status === "locked";
  return {
    title: article.title,
    // Drafts, unpublished and archived articles must not be indexed.
    robots: isPublic ? undefined : { index: false, follow: false },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedIn = Boolean(user);

  const isPublic = article.status === "published" || article.status === "locked";

  const provenance =
    article.can_edit || signedIn
      ? await resolveArticleProvenance(article.id, {
          userId: signedIn && user ? user.id : null,
          canEdit: article.can_edit,
        })
      : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="text-fg-muted text-sm">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link
              href="/codex"
              className="inline-flex min-h-6 items-center underline-offset-4 transition-colors hover:text-fg"
            >
              Codex Libre
            </Link>
          </li>
          <li aria-hidden="true" className="text-fg-subtle">
            /
          </li>
          <li>
            <Link
              href={`/codex?category=${article.category_slug}`}
              className="inline-flex min-h-6 items-center underline-offset-4 transition-colors hover:text-fg"
            >
              {article.category_name}
            </Link>
          </li>
        </ol>
      </nav>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <h1 className="text-fg font-display text-3xl font-semibold tracking-tight">
          {article.title}
        </h1>
        {!isPublic ? (
          <Badge variant="warning">{ARTICLE_STATUS_LABELS[article.status]}</Badge>
        ) : article.status === "locked" ? (
          <Badge variant="outline">
            <LockSimpleIcon aria-hidden="true" className="h-3 w-3" />
            Locked
          </Badge>
        ) : null}
      </div>
      <p className="text-fg-subtle mt-2 text-sm">
        {article.author_display_name} ·{" "}
        {article.published_at ? `${formatRelativeTime(article.published_at)} · ` : ""}v
        {article.version}
      </p>

      {!isPublic ? (
        <div
          role="note"
          className="border-border text-fg-subtle mt-4 rounded-md border border-dashed px-4 py-3 text-sm"
        >
          This article is not public. Only Archivists can see it in this state.
        </div>
      ) : null}

      {/* Safe by construction: renderMarkdown escapes author text before emitting
          its own closed tag set. See src/lib/content/markdown.ts. */}
      <div
        className="text-fg mt-7 max-w-[68ch] text-[15px] leading-7 [&_a]:text-brand [&_a]:underline-offset-4 [&_a:hover]:underline [&_h2]:mt-7 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:tracking-tight [&_p]:mt-4 [&_p:first-child]:mt-0 [&_blockquote]:border-s-2 [&_blockquote]:border-brand/30 [&_blockquote]:ps-4 [&_blockquote]:text-fg-muted [&_blockquote]:italic [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:ps-5 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:ps-5 [&_li]:mt-1 [&_code]:rounded [&_code]:bg-bg-raised [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_pre]:mt-4 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border [&_pre]:bg-bg-raised [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-sm [&_pre]:leading-6 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_hr]:my-6 [&_hr]:border-border [&_strong]:font-semibold [&_em]:italic"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body, { maxLength: 100_000 }) }}
      />

      <div className="border-border mt-8 flex flex-wrap items-center gap-3 border-t pt-4">
        {signedIn && isPublic ? (
          <BookmarkButton articleId={article.id} initialBookmarked={article.caller_bookmarked} />
        ) : null}
        <CopyLinkButton path={`/codex/${article.slug}`} />
        {article.can_edit ? (
          <Button asChild variant="secondary">
            <Link href={`/council/codex/${article.slug}/edit`}>
              <PencilSimpleIcon aria-hidden="true" className="h-4 w-4" />
              Edit in Council
            </Link>
          </Button>
        ) : null}
      </div>

      {signedIn && isPublic ? (
        <div className="border-border mt-6 border-t pt-4">
          <SuggestionForm articleId={article.id} />
        </div>
      ) : null}

      {provenance ? <ProvenancePanel provenance={provenance} /> : null}
    </main>
  );
}
