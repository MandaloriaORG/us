import Link from "next/link";

import { getCouncilPlazaAccess } from "@/app/council/access";
import { PlazaForm } from "@/components/system/plaza-form";
import { EmptyState } from "@/components/ui/empty-state";

// Authorization is request-bound and must never run at build time.
export const dynamic = "force-dynamic";

/**
 * Create a new Plaza. Substantial admin work, so it is a page, not a dialog.
 */
export default async function NewPlazaPage() {
  const access = await getCouncilPlazaAccess();

  if (!access.allowed) {
    return (
      <section>
        <h1 className="text-fg text-2xl font-semibold">New Plaza</h1>
        <EmptyState
          title="You cannot create a Plaza"
          description="Managing Plazas needs the Plaza administration permission. Ask an administrator if you should have it."
          action={{ label: "Back to Council", href: "/council" }}
        />
      </section>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <p className="text-fg-muted text-sm">
        <Link href="/council/plazas" className="hover:text-fg">
          Plazas
        </Link>
      </p>
      <h1 className="text-fg mt-1 text-2xl font-semibold">New Plaza</h1>
      <PlazaForm mode="create" />
    </div>
  );
}
