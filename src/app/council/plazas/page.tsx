import { BuildingsIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { getCouncilPlazaAccess } from "@/app/council/access";
import { Badge } from "@/components/origin/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { listPlazas, type PlazaSummary } from "@/lib/content/queries";

const STATUS_VARIANTS = {
  active: "success",
  archived: "outline",
} as const;

// Authorization and Plaza data are request-bound and must never run at build time.
export const dynamic = "force-dynamic";

/**
 * Plaza administration: create, edit and archive Plazas.
 *
 * `list_plazas()` already resolves an Administrator's broader view, so a
 * caller with `admin.manage_plazas` sees private and archived Plazas here too
 * — there is no separate admin listing to call.
 */
export default async function CouncilPlazasPage() {
  const access = await getCouncilPlazaAccess();

  if (!access.allowed) {
    return (
      <section>
        <h1 className="text-fg text-2xl font-semibold">Plazas</h1>
        <EmptyState
          title="You cannot manage Plazas"
          description="Managing Plazas needs the Plaza administration permission. Ask an administrator if you should have it."
          action={{ label: "Back to Council", href: "/council" }}
        />
      </section>
    );
  }

  const plazas = await listPlazas();

  const columns: DataTableColumn<PlazaSummary>[] = [
    {
      id: "name",
      header: () => "Name",
      cell: (plaza) => (
        <div className="min-w-0">
          <Link
            href={`/council/plazas/${plaza.id}`}
            className="text-fg hover:text-brand focus:ring-border-focus min-h-11 min-w-0 font-medium underline-offset-4 hover:underline focus:ring-2 focus:outline-hidden"
          >
            {plaza.name}
          </Link>
          <p className="text-fg-muted mt-0.5 text-sm">/{plaza.slug}</p>
        </div>
      ),
    },
    {
      id: "visibility",
      header: () => "Visibility",
      cellClassName: "text-fg-muted capitalize",
      cell: (plaza) => plaza.visibility,
    },
    {
      id: "status",
      header: () => "Status",
      cell: (plaza) => (
        <Badge className="capitalize" variant={STATUS_VARIANTS[plaza.status]}>
          {plaza.status}
        </Badge>
      ),
    },
    {
      id: "posts",
      header: () => "Posts",
      cellClassName: "tabular-nums text-fg-muted",
      cell: (plaza) => plaza.posts_count,
    },
  ];

  const noPlazas = (
    <EmptyState
      icon={<BuildingsIcon aria-hidden="true" className="h-6 w-6" />}
      title="No Plazas exist yet"
      description="Create the first Plaza to open a discussion space for the community."
      action={{ label: "New Plaza", href: "/council/plazas/new" }}
    />
  );

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-fg text-2xl font-semibold">Plazas</h1>
          <p className="text-fg-muted mt-1 text-sm">Create, edit and archive discussion spaces.</p>
        </div>
        <Button asChild>
          <Link href="/council/plazas/new">New Plaza</Link>
        </Button>
      </div>

      <DataTable
        ariaLabel="Plazas"
        caption="Every Plaza, its visibility, status and post count"
        className="mt-6"
        columns={columns}
        emptyState={noPlazas}
        rowKey={(plaza) => plaza.id}
        rows={plazas}
        tableClassName="min-w-160"
      />
    </div>
  );
}
