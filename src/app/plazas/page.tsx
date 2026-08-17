import Link from "next/link";

import { plazaHue } from "@/components/system/plaza-chip";
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
 * DESIGN — implemented by this file:
 * - Plazas are destinations with their own identity, so each renders as a card
 *   with a monogram emblem tile tinted from its slug (`plazaHue`), its name in
 *   the display face, a description and a quiet post count.
 * - An archived Plaza carries a status badge and reads as read-only without
 *   relying on colour alone.
 * - The empty state states why the directory is empty for this specific viewer
 *   and offers a concrete next step, never a bare "no data".
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

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {plazas.map((plaza) => {
          const hue = plazaHue(plaza.slug);
          return (
            <li key={plaza.id} className="min-w-0">
              <Link
                href={`/plazas/${plaza.slug}`}
                className="group border-border bg-bg-raised duration-fast hover:border-brand/45 focus-visible:ring-border-focus grid min-h-11 min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-lg border p-4 transition-all hover:-translate-y-px hover:shadow-lg focus-visible:ring-2 focus-visible:outline-hidden"
              >
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-base font-semibold"
                  style={{
                    backgroundColor: `hsl(${hue} 26% 19%)`,
                    color: `hsl(${hue} 42% 78%)`,
                    boxShadow: `inset 0 0 0 1px hsl(${hue} 42% 38% / 0.35)`,
                  }}
                >
                  {plaza.name.trim().charAt(0).toLocaleUpperCase() || "?"}
                </span>

                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-fg duration-fast group-hover:text-brand text-lg leading-tight font-semibold tracking-tight transition-colors">
                      {plaza.name}
                    </span>
                    {plaza.status === "archived" ? (
                      <span className="border-border text-fg-muted rounded-full border px-2 py-0.5 text-[11px] font-medium">
                        Archived
                      </span>
                    ) : null}
                  </span>
                  {plaza.description ? (
                    <span className="text-fg-muted line-clamp-2 text-sm">{plaza.description}</span>
                  ) : null}
                  <span className="text-fg-subtle mt-1 text-xs">
                    {plaza.posts_count} {plaza.posts_count === 1 ? "post" : "posts"}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
