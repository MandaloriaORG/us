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
 * - The header carries the same identity treatment as the public home (gold
 *   gradient headline, ambient brand glow) so Plazas reads as part of the
 *   product, not a bare data page.
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
      <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mb-8 flex justify-start">
          <h1 className="font-display text-fg from-brand via-brand-deep to-warning bg-linear-to-r bg-clip-text text-4xl font-semibold tracking-tight text-transparent">
            Plazas
          </h1>
        </div>
        <EmptyState
          title="No Plazas are open to you yet"
          description="Plazas appear here once the Council opens them, or once you sign in with an account that can see them."
          action={{ label: "Go to the home page", href: "/" }}
        />
      </main>
    );
  }

  return (
    <main className="relative overflow-hidden">
      {/* Ambient brand glow, same treatment as the public hero. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="from-brand/10 absolute inset-x-0 top-0 h-72 bg-linear-to-b via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_-10%,var(--color-brand/14),transparent_70%)]" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <header className="max-w-2xl">
          <h1 className="font-display text-fg from-brand via-brand-deep to-warning bg-linear-to-r bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
            Plazas
          </h1>
          <p className="text-fg-muted mt-3 text-base sm:text-lg">
            Every Plaza is a space with its own subject and standards. Pick one,
            join the conversation, and earn your place in it.
          </p>
        </header>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2">
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
      </div>
    </main>
  );
}
