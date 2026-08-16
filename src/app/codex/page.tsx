import Link from "next/link";
import type { Metadata } from "next";
import { MagnifyingGlassIcon, BooksIcon } from "@phosphor-icons/react/dist/ssr";

import { createClient } from "@/lib/supabase/server";
import { CodexHeader } from "@/app/codex/codex-header";
import { ArticleRow } from "@/app/codex/article-row";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { listArticles, listCodexCategories } from "@/lib/codex/queries";
import { formatRelativeTime } from "@/lib/time";

export const metadata: Metadata = {
  title: "Codex Libre",
  description:
    "Mandaloria's reviewed and versioned knowledge library, distilled from community conversations.",
};

export const dynamic = "force-dynamic";

interface CodexLibraryPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    cursor?: string;
  }>;
}

function nextPageHref(q: string, category: string, cursor: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  params.set("cursor", cursor);
  return `/codex?${params.toString()}`;
}

export default async function CodexLibraryPage({ searchParams }: CodexLibraryPageProps) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const category = typeof params.category === "string" ? params.category : "";
  const cursor = typeof params.cursor === "string" ? params.cursor : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [categories, page] = await Promise.all([
    listCodexCategories(),
    listArticles({ categorySlug: category || null, query: q || null, cursor }),
  ]);

  const hasFilter = Boolean(q) || Boolean(category);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="sr-only">Codex Libre</h1>
      <CodexHeader signedIn={Boolean(user)} />

      <form className="mt-5 flex flex-col gap-2 sm:flex-row" role="search">
        <label className="sr-only" htmlFor="codex-search">
          Search articles
        </label>
        <div className="relative flex-1">
          <MagnifyingGlassIcon
            aria-hidden="true"
            className="text-fg-muted pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          />
          <input
            className="border-border bg-bg text-fg placeholder:text-fg-subtle focus-visible:ring-border-focus h-11 w-full rounded-md border ps-10 pe-3 text-sm outline-hidden transition-colors focus-visible:ring-2"
            defaultValue={q}
            id="codex-search"
            name="q"
            placeholder="Search the library"
            type="search"
          />
        </div>
        {category ? <input name="category" type="hidden" value={category} /> : null}
        <button
          className="bg-brand text-brand-fg duration-fast focus-visible:ring-border-focus inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-hidden"
          type="submit"
        >
          Search
        </button>
      </form>

      <nav aria-label="Categories" className="mt-4 flex flex-wrap gap-2">
        <CategoryChip active={!category} href={categoryHref(q, "")} label="All" />
        {categories.map((item) => (
          <CategoryChip
            active={category === item.slug}
            href={categoryHref(q, item.slug)}
            key={item.id}
            label={item.name}
          />
        ))}
      </nav>

      {page.items.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={<BooksIcon aria-hidden="true" className="h-6 w-6" />}
          title={hasFilter ? "Nothing matches this search" : "The library is empty"}
          description={
            hasFilter
              ? "No published article matches those terms. Clear the filters to see the whole library."
              : "Reviewed articles will appear here once an Archivist publishes the first one."
          }
          action={hasFilter ? { label: "Clear filters", href: "/codex" } : undefined}
        />
      ) : (
        <>
          <ul className="divide-border border-border mt-4 divide-y border-y">
            {page.items.map((article) => (
              <ArticleRow
                article={article}
                key={article.id}
                meta={`${article.category_name} · ${formatRelativeTime(article.published_at)}`}
              />
            ))}
          </ul>

          {page.nextCursor ? (
            <Link
              href={nextPageHref(q, category, page.nextCursor)}
              className="text-fg-muted hover:text-fg focus-visible:ring-border-focus mt-6 inline-flex min-h-11 items-center underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
            >
              Next page
            </Link>
          ) : null}
        </>
      )}
    </main>
  );
}

function categoryHref(q: string, category: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  const query = params.toString();
  return query ? `/codex?${query}` : "/codex";
}

function CategoryChip({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "border-border text-fg-muted duration-fast hover:bg-bg-raised hover:text-fg focus-visible:ring-border-focus inline-flex min-h-11 items-center rounded-full border px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-hidden",
        active && "bg-bg-raised border-border-raised text-fg",
      )}
      href={href}
    >
      {label}
    </Link>
  );
}
