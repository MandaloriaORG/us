import Link from "next/link";
import { notFound } from "next/navigation";

import { getCouncilPlazaAccess } from "@/app/council/access";
import { PlazaForm } from "@/components/system/plaza-form";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getPlaza,
  getPlazaPostPermission,
  listPermissions,
  listPlazas,
} from "@/lib/content/queries";
import { PlazaStatusControl } from "./plaza-status-control";

// Authorization and Plaza data are request-bound and must never run at build time.
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface CouncilPlazaDetailPageProps {
  params: Promise<{ plazaId: string }>;
}

/**
 * Edit a Plaza and archive/reactivate it.
 *
 * `updatePlaza` needs the Plaza's id, but the read side only looks up a Plaza
 * by slug (`getPlaza`), so the route resolves the id to a slug via
 * `listPlazas()` first — that call already returns every Plaza an
 * administrator may see, private and archived included, so no extra query is
 * needed beyond the one `getPlaza` makes for the full detail (rules).
 */
export default async function CouncilPlazaDetailPage({ params }: CouncilPlazaDetailPageProps) {
  const access = await getCouncilPlazaAccess();

  if (!access.allowed) {
    return (
      <section>
        <h1 className="text-fg text-2xl font-semibold">Plaza</h1>
        <EmptyState
          title="You cannot manage this Plaza"
          description="Managing Plazas needs the Plaza administration permission. Ask an administrator if you should have it."
          action={{ label: "Back to Council", href: "/council" }}
        />
      </section>
    );
  }

  const { plazaId } = await params;
  if (!UUID_PATTERN.test(plazaId)) notFound();

  const plazas = await listPlazas();
  const summary = plazas.find((plaza) => plaza.id === plazaId);
  if (!summary) notFound();

  const plaza = await getPlaza(summary.slug);
  if (!plaza) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl">
      <p className="text-fg-muted text-sm">
        <Link href="/council/plazas" className="hover:text-fg">
          Plazas
        </Link>
      </p>
      <h1 className="text-fg mt-1 text-2xl font-semibold">{plaza.name}</h1>

      <PlazaForm
        candidatePermissions={await listPermissions()}
        initialRequiredPostPermission={await getPlazaPostPermission(plazaId)}
        mode="edit"
        plazaId={plazaId}
        initialSlug={plaza.slug}
        initialName={plaza.name}
        initialDescription={plaza.description}
        initialRules={plaza.rules}
        initialVisibility={plaza.visibility}
        initialSortOrder={summary.sort_order}
      />

      <PlazaStatusControl plazaId={plazaId} status={plaza.status} />
    </div>
  );
}
