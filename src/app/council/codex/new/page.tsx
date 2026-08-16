import type { Metadata } from "next";

import { ArticleForm } from "@/app/council/codex/new/article-form";
import { listCodexCategories } from "@/lib/codex/queries";

export const metadata: Metadata = {
  title: "New article · Codex",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface NewArticlePageProps {
  searchParams: Promise<{ title?: string; proposal?: string }>;
}

export default async function NewArticlePage({ searchParams }: NewArticlePageProps) {
  const params = await searchParams;
  const categories = await listCodexCategories();

  return (
    <div>
      <h2 className="text-fg text-lg font-semibold">New article</h2>
      <p className="text-fg-muted mt-1 text-sm">
        Articles start as drafts. Only a reviewed draft is ever published.
      </p>
      <ArticleForm
        categories={categories}
        initialTitle={typeof params.title === "string" ? params.title.slice(0, 300) : ""}
      />
    </div>
  );
}
