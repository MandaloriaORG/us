import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EditorForm } from "@/app/council/codex/[slug]/edit/editor-form";
import { getCodexCouncilAccess } from "@/app/council/codex/codex-access";
import { EmptyState } from "@/components/ui/empty-state";
import { getArticle, listArticleVersions } from "@/lib/codex/queries";

export const metadata: Metadata = {
  title: "Edit article · Codex",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface EditArticlePageProps {
  params: Promise<{ slug: string }>;
}

export default async function EditArticlePage({ params }: EditArticlePageProps) {
  const access = await getCodexCouncilAccess();
  if (!access.allowed) {
    return (
      <EmptyState
        title="Archivist access required"
        description="Editing Codex Libre needs the codex.edit permission."
      />
    );
  }

  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const versions = await listArticleVersions(article.id);

  return <EditorForm article={article} canPublish={access.canPublish} versions={versions} />;
}
