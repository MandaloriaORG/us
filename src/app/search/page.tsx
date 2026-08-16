import type { Metadata } from "next";
import Link from "next/link";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { listPlazas } from "@/lib/content/queries";
import {
  parseSearchFilters,
  searchContent,
  searchHref,
  type SearchFilterSearchParams,
  type SearchResult,
} from "@/lib/search";

import { SearchFilterForm } from "./search-filter-form";
import { SearchResultList } from "./search-result-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search",
  robots: {
    index: false,
    follow: false,
  },
};

interface SearchPageProps {
  searchParams?: SearchFilterSearchParams;
}

function renderSearchOutcome(
  filters: Extract<ReturnType<typeof parseSearchFilters>, { kind: "valid" }>,
  results: { hasNext: boolean; items: SearchResult[] },
  plazaNames: Readonly<Record<string, string>>,
) {
  if (results.items.length === 0) {
    const pageOverflow = filters.page > 1;

    return (
      <EmptyState
        icon={<MagnifyingGlassIcon className="h-8 w-8" />}
        title={
          pageOverflow
            ? `No results on page ${filters.page}`
            : `No results for “${filters.values.q.trim()}”`
        }
        description={
          pageOverflow
            ? "Try an earlier page, or widen the search by removing a filter."
            : "Try different words, or remove a filter to widen the search."
        }
        action={
          pageOverflow
            ? {
                label: "Previous page",
                href: searchHref(filters.canonicalQuery, filters.page - 1),
              }
            : filters.canonicalQuery
              ? { label: "Clear search", href: "/search" }
              : undefined
        }
      />
    );
  }

  return (
    <>
      <SearchResultList items={results.items} plazaNames={plazaNames} />

      {filters.page > 1 || results.hasNext ? (
        <nav
          aria-label="Search results pagination"
          className="border-border mt-6 flex items-center justify-between gap-4 border-t pt-4"
        >
          {filters.page > 1 ? (
            <Button asChild variant="secondary">
              <Link href={searchHref(filters.canonicalQuery, filters.page - 1)}>Previous</Link>
            </Button>
          ) : (
            <span />
          )}

          <span className="text-fg-muted text-sm tabular-nums">Page {filters.page}</span>

          {results.hasNext ? (
            <Button asChild variant="secondary">
              <Link href={searchHref(filters.canonicalQuery, filters.page + 1)}>Next</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const plazas = await listPlazas();
  const filters = parseSearchFilters(searchParams, plazas);
  const errors = filters.kind === "invalid" ? filters.errors : {};
  const plazaNames = Object.fromEntries(plazas.map((plaza) => [plaza.slug, plaza.name]));

  const outcome = filters.kind === "valid" ? await searchContent(filters) : null;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
      <div>
        <h1 className="text-fg text-2xl font-semibold">Search</h1>
        <p className="text-fg-muted mt-1 text-sm">
          Find posts, comments and Codex articles. Results respect what you are allowed to see.
        </p>
      </div>

      <SearchFilterForm errors={errors} plazas={plazas} values={filters.values} />

      {filters.kind === "idle" ? (
        <EmptyState
          icon={<MagnifyingGlassIcon className="h-8 w-8" />}
          title="Search the community"
          description="Type a query above to search posts, comments and Codex articles across the Plazas."
        />
      ) : null}

      {filters.kind === "invalid" ? (
        <section aria-labelledby="search-filter-errors-title" className="mt-6 max-w-xl">
          <h2 id="search-filter-errors-title" className="text-fg text-base font-semibold">
            Check the search filters
          </h2>
          <p className="text-fg-muted mt-1 text-sm">
            Correct the fields marked above before loading results.
          </p>
          <Button asChild className="mt-4" variant="secondary">
            <Link href="/search">Clear search</Link>
          </Button>
        </section>
      ) : null}

      {filters.kind === "valid" && outcome
        ? renderSearchOutcome(filters, outcome, plazaNames)
        : null}
    </main>
  );
}
