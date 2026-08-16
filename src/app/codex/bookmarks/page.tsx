import Link from "next/link";
import type { Metadata } from "next";
import { BookmarkSimpleIcon } from "@phosphor-icons/react/dist/ssr";

import { createClient } from "@/lib/supabase/server";
import { CodexHeader } from "@/app/codex/codex-header";
import { EmptyState } from "@/components/ui/empty-state";
import { listOwnCodexBookmarks } from "@/lib/codex/queries";
import { formatRelativeTime } from "@/lib/time";

export const metadata: Metadata = {
  title: "Saved articles",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface BookmarksPageProps {
  searchParams: Promise<{ cursor?: string }>;
}

export default async function CodexBookmarksPage({ searchParams }: BookmarksPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <CodexHeader signedIn={false} />
        <EmptyState
          className="mt-10"
          icon={<BookmarkSimpleIcon aria-hidden="true" className="h-6 w-6" />}
          title="Sign in to save articles"
          description="Your saved articles live here. Sign in to keep the library with you."
          action={{ label: "Sign in", href: "/auth/login" }}
        />
      </main>
    );
  }

  const { cursor } = await searchParams;
  const page = await listOwnCodexBookmarks({ cursor: cursor ?? null });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <CodexHeader signedIn={true} />
      <h1 className="text-fg mt-6 text-xl font-semibold">Saved articles</h1>

      {page.items.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={<BookmarkSimpleIcon aria-hidden="true" className="h-6 w-6" />}
          title="Nothing saved yet"
          description="When you save an article it appears here for quick reading."
          action={{ label: "Browse the library", href: "/codex" }}
        />
      ) : (
        <>
          <ul className="divide-border border-border mt-4 divide-y border-y">
            {page.items.map((bookmark) => (
              <li className="py-4" key={bookmark.bookmark_id}>
                <Link
                  href={`/codex/${bookmark.slug}`}
                  className="text-fg hover:text-brand focus-visible:ring-border-focus font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
                >
                  {bookmark.title}
                </Link>
                <p className="text-fg-subtle mt-1 text-xs">
                  {bookmark.category_slug} · {bookmark.author_display_name} · saved{" "}
                  {formatRelativeTime(bookmark.bookmarked_at)}
                </p>
              </li>
            ))}
          </ul>
          {page.nextCursor ? (
            <Link
              href={`/codex/bookmarks?cursor=${encodeURIComponent(page.nextCursor)}`}
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
