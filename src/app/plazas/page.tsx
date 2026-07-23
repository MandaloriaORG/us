import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { listPlazas } from "@/lib/content/queries";

/**
 * Plaza directory.
 *
 * DATA CONTRACT — implemented, do not change without the RPC:
 * `list_plazas()` already filters by visibility, so this route renders whatever
 * it receives. An anonymous visitor sees public Plazas only; a member also sees
 * `members` Plazas; `private` Plazas need `admin.manage_plazas`. There is no
 * client-side filtering to add, and adding one would be a privacy bug.
 *
 * DESIGN — not implemented, owned by the UI workstream:
 * - Plazas are a homogeneous list of equal-weight destinations, so the row
 *   pattern applies, not cards (`docs/DESIGN_SYSTEM.md`, rows vs cards).
 * - Each row needs name, description and post count. `posts_count` is quiet
 *   metadata, not a badge.
 * - An archived Plaza must read as archived without relying on colour alone.
 * - The empty state below is a placeholder: it should state why the directory
 *   is empty for this specific viewer rather than saying "no data".
 * - Ordering is `sort_order` then name, decided by the database. The UI must not
 *   re-sort.
 */
export default async function PlazasPage() {
  const plazas = await listPlazas();

  if (plazas.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <h1 className="text-fg text-2xl font-semibold">Plazas</h1>
        <EmptyState
          title="No Plazas are open to you yet"
          description="Plazas appear here once the Council opens them, or once you sign in with an account that can see them."
          action={{ label: "Go to the home page", href: "/" }}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="text-fg text-2xl font-semibold">Plazas</h1>

      <ul className="border-border mt-6 border-b">
        {plazas.map((plaza) => (
          <li key={plaza.id} className="border-border border-t">
            <Link
              href={`/plazas/${plaza.slug}`}
              className="group duration-fast hover:bg-surface focus-visible:bg-surface focus-visible:ring-border-focus grid min-h-11 min-w-0 gap-1 py-4 transition-colors focus-visible:ring-2 focus-visible:outline-hidden sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-4"
            >
              <span className="min-w-0">
                <span className="text-fg duration-fast group-hover:text-brand font-medium transition-colors">
                  {plaza.name}
                </span>
                {plaza.description ? (
                  <span className="text-fg-muted mt-0.5 block text-sm">{plaza.description}</span>
                ) : null}
              </span>
              <span className="text-fg-subtle text-sm text-nowrap sm:text-right">
                {plaza.posts_count} {plaza.posts_count === 1 ? "post" : "posts"}
                {plaza.status === "archived" ? " · Archived" : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
