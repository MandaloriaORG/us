import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr";

import { PostList } from "@/components/system/post-list";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getPlaza, listPosts, parsePostOrder } from "@/lib/content/queries";
import { cn } from "@/lib/cn";

/**
 * Plaza detail: the Plaza's own information plus its post listing.
 *
 * DATA CONTRACT — implemented:
 * - `get_plaza` returns nothing when the Plaza is invisible to the caller, which
 *   this route turns into a 404. A visitor must not be able to tell an invisible
 *   Plaza apart from one that does not exist.
 * - `can_post` is computed by the database from the caller's permissions, the
 *   Plaza's status and its `required_post_permission`. It is the only thing the
 *   UI may use to decide whether to offer a compose affordance, and the RPC
 *   re-checks it on submit regardless.
 * - Listing state lives in the URL (`order`, `tag`, `cursor`) so Back restores
 *   the exact page, per `.agent/DESIGN_RULES.md`.
 *
 * DESIGN — implemented by this file:
 * - Header: name, description, rules. Rules are long-form and sit behind a
 *   native `<details>` disclosure, collapsed by default.
 * - Post rows carry title, author, age, comment count and score; the counts
 *   are right-aligned and tabular.
 * - `order` is a two-value navigation control: real links, not a form.
 * - Pagination is a forward-only "Next" link; there is no page count to show.
 * - The empty state distinguishes "this Plaza has no posts yet" from "your tag
 *   filter matched nothing", and the latter offers a way to clear it.
 * - The compose entry point renders only when `can_post` is true.
 */
interface PlazaPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ order?: string; tag?: string; cursor?: string }>;
}

export default async function PlazaPage({ params, searchParams }: PlazaPageProps) {
  const { slug } = await params;
  const { order: rawOrder, tag, cursor } = await searchParams;

  const plaza = await getPlaza(slug);
  if (!plaza) notFound();

  const order = parsePostOrder(rawOrder);
  const posts = await listPosts({
    plazaId: plaza.id,
    order,
    tagSlug: tag ?? null,
    cursor: cursor ?? null,
  });

  const listingHref = (next: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    if (next.order && next.order !== "recent") query.set("order", next.order);
    if (next.tag) query.set("tag", next.tag);
    if (next.cursor) query.set("cursor", next.cursor);
    const suffix = query.toString();
    return suffix ? `/plazas/${slug}?${suffix}` : `/plazas/${slug}`;
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-fg text-2xl font-semibold">{plaza.name}</h1>
          {plaza.description ? (
            <p className="text-fg-muted mt-1 text-sm">{plaza.description}</p>
          ) : null}
          {plaza.status === "archived" ? (
            <p className="text-fg-subtle mt-1 text-xs">Archived — read only, no new posts.</p>
          ) : null}
        </div>
        {plaza.can_post ? (
          <Button asChild size="sm" className="shrink-0">
            <Link href={`/plazas/${slug}/new`}>New post</Link>
          </Button>
        ) : null}
      </div>

      {plaza.rules ? (
        <details className="border-border group mt-5 rounded-md border">
          <summary className="text-fg focus-visible:ring-border-focus flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium marker:hidden focus-visible:ring-2 focus-visible:outline-hidden">
            Plaza rules
            <CaretDownIcon
              aria-hidden="true"
              className="text-fg-subtle h-4 w-4 transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="border-border text-fg-muted border-t px-4 py-3 text-sm whitespace-pre-wrap">
            {plaza.rules}
          </div>
        </details>
      ) : null}

      <nav aria-label="Post ordering" className="border-border mt-6 flex gap-1 border-b">
        <Link
          href={listingHref({ order: "recent", tag })}
          aria-current={order === "recent" ? "page" : undefined}
          className={cn(
            "duration-fast border-b-2 px-3 py-2 text-sm transition-colors",
            order === "recent"
              ? "border-brand text-fg font-semibold"
              : "text-fg-muted hover:text-fg border-transparent font-medium",
          )}
        >
          Recent
        </Link>
        <Link
          href={listingHref({ order: "popular", tag })}
          aria-current={order === "popular" ? "page" : undefined}
          className={cn(
            "duration-fast border-b-2 px-3 py-2 text-sm transition-colors",
            order === "popular"
              ? "border-brand text-fg font-semibold"
              : "text-fg-muted hover:text-fg border-transparent font-medium",
          )}
        >
          Popular
        </Link>
      </nav>

      {tag ? (
        <p className="text-fg-muted mt-4 text-sm">
          Filtered by tag <span className="text-fg font-medium">{tag}</span>.{" "}
          <Link
            href={listingHref({ order })}
            className="text-brand underline-offset-4 hover:underline"
          >
            Clear filter
          </Link>
        </p>
      ) : null}

      {posts.items.length === 0 ? (
        tag ? (
          <EmptyState
            title="No posts carry that tag"
            description={`No posts in ${plaza.name} are tagged "${tag}" yet.`}
            action={{ label: "Clear tag filter", href: listingHref({ order }) }}
          />
        ) : (
          <EmptyState
            title="No posts yet"
            description={
              plaza.can_post
                ? `Nobody has posted in ${plaza.name} yet. Be the first.`
                : `Nobody has posted in ${plaza.name} yet.`
            }
            action={
              plaza.can_post
                ? { label: "Start the first post", href: `/plazas/${slug}/new` }
                : undefined
            }
          />
        )
      ) : (
        <PostList
          posts={posts.items}
          nextHref={posts.nextCursor ? listingHref({ order, tag, cursor: posts.nextCursor }) : null}
        />
      )}
    </main>
  );
}
