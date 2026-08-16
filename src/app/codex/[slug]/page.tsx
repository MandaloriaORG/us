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
      <p className="text-fg-muted text-sm">
        <Link href="/codex" className="hover:text-fg">
          Codex Libre
        </Link>
        {" · "}
        <Link href={`/codex?category=${article.category_slug}`} className="hover:text-fg">
          {article.category_name}
        </Link>
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h1 className="text-fg text-2xl font-semibold">{article.title}</h1>
        {!isPublic ? (
          <Badge variant="warning">{ARTICLE_STATUS_LABELS[article.status]}</Badge>
        ) : article.status === "locked" ? (
          <Badge variant="outline">
            <LockSimpleIcon aria-hidden="true" className="h-3 w-3" />
            Locked
          </Badge>
        ) : null}
      </div>
      <p className="text-fg-subtle mt-1 text-sm">
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
        className="text-fg [&_a]:text-brand mt-5 max-w-none text-sm leading-relaxed [&_a]:underline-offset-4 [&_a:hover]:underline [&_p]:mt-3 [&_p:first-child]:mt-0"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body, { maxLength: 100_000 }) }}
      />

      <div className="border-border mt-6 flex flex-wrap items-center gap-3 border-t pt-4">
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
