import Link from "next/link";
import {
  BooksIcon,
  PaperPlaneTiltIcon,
  PlusIcon,
  SealQuestionIcon,
} from "@phosphor-icons/react/dist/ssr";

import { getCodexCouncilAccess } from "@/app/council/codex/codex-access";
import { CategoryManager } from "@/app/council/codex/category-manager";
import { ArticleRow } from "@/app/codex/article-row";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { listArticles, listCodexCategories } from "@/lib/codex/queries";
import { formatRelativeTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function CodexCouncilDashboard() {
  const access = await getCodexCouncilAccess();
  if (!access.allowed) {
    return (
      <EmptyState
        title="Archivist access required"
        description="Writing to Codex Libre needs the codex.edit permission."
      />
    );
  }

  const [page, categories] = await Promise.all([listArticles(), listCodexCategories()]);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="articles-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-fg text-lg font-semibold" id="articles-heading">
            Articles
          </h2>
          <Button asChild size="md">
            <Link href="/council/codex/new">
              <PlusIcon aria-hidden="true" className="h-4 w-4" />
              New article
            </Link>
          </Button>
        </div>

        {page.items.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={<BooksIcon aria-hidden="true" className="h-6 w-6" />}
            title="No published articles"
            description="Publish the first article to fill the library."
            action={{ label: "Write an article", href: "/council/codex/new" }}
          />
        ) : (
          <ul className="divide-border border-border mt-4 divide-y border-y">
            {page.items.map((article) => (
              <ArticleRow
                article={article}
                href={`/council/codex/${article.slug}/edit`}
                key={article.id}
                meta={`${article.category_name} · ${formatRelativeTime(article.published_at)}`}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="queues-heading" className="border-border border-t pt-6">
        <h2 className="text-fg text-lg font-semibold" id="queues-heading">
          Review queues
        </h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button asChild variant="secondary" size="md">
            <Link href="/council/codex/proposals">
              <PaperPlaneTiltIcon aria-hidden="true" className="h-4 w-4" />
              Proposals
            </Link>
          </Button>
          <Button asChild variant="secondary" size="md">
            <Link href="/council/codex/suggestions">
              <SealQuestionIcon aria-hidden="true" className="h-4 w-4" />
              Suggestions
            </Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="categories-heading" className="border-border border-t pt-6">
        <CategoryManager categories={categories} />
      </section>
    </div>
  );
}
