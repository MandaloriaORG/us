import { CapabilityList } from "@/components/marketing/capability-list";
import { ProductPrinciples } from "@/components/marketing/product-principles";
import { PublicHero } from "@/components/marketing/public-hero";
import { KnowledgePipeline } from "@/components/system/knowledge-pipeline";
import { PostList } from "@/components/system/post-list";
import { EmptyState } from "@/components/ui/empty-state";
import { listPosts } from "@/lib/content/queries";

/**
 * Public home page: identity marketing plus the cross-Plaza recent-posts feed.
 *
 * DATA CONTRACT — implemented:
 * - `listPosts({ order: "recent" })` is called with no `plazaId`, so it spans
 *   every Plaza the caller may see (RLS/the RPC already enforce visibility;
 *   there is no client-side filtering to add).
 * - Pagination is the same cursor-in-the-URL convention as `plazas/[slug]`, so
 *   Back restores the exact page.
 *
 * DESIGN — implemented by this file:
 * - Marketing sections are unchanged; this only adds a "Recent posts" section
 *   below them, sharing `system/post-list` with the Plaza detail page.
 * - Rows show the Plaza name, since a cross-Plaza feed row is otherwise
 *   ambiguous about where the post lives.
 */
interface HomePageProps {
  searchParams: Promise<{ cursor?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { cursor } = await searchParams;
  const posts = await listPosts({ order: "recent", cursor: cursor ?? null });

  return (
    <main className="min-h-[calc(100svh-3rem)]">
      <PublicHero visual={<KnowledgePipeline />} />
      <ProductPrinciples />
      <CapabilityList />

      <section aria-labelledby="recent-posts-title">
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <h2 id="recent-posts-title" className="text-fg text-2xl font-semibold tracking-tight">
            Recent posts
          </h2>

          {posts.items.length === 0 ? (
            <EmptyState
              className="mt-8"
              title="No posts yet"
              description="Nobody has posted in any Plaza yet."
            />
          ) : (
            <PostList
              posts={posts.items}
              showPlazaName
              nextHref={
                posts.nextCursor ? `/?cursor=${encodeURIComponent(posts.nextCursor)}` : null
              }
            />
          )}
        </div>
      </section>
    </main>
  );
}
