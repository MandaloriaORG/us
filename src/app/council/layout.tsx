import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, ShieldWarningIcon } from "@phosphor-icons/react/dist/ssr";
import { getCouncilShellAccess } from "./access";
import { CouncilNavigation } from "./council-navigation";

export const metadata: Metadata = {
  title: "Council",
  robots: {
    index: false,
    follow: false,
  },
};

// Authorization and Council data are request-bound and must never run at build time.
export const dynamic = "force-dynamic";

export default async function CouncilLayout({ children }: { children: React.ReactNode }) {
  const access = await getCouncilShellAccess();

  if (!access.allowed) {
    const verificationFailed = access.reason === "verification_failed";

    return (
      <main className="flex min-h-[calc(100vh-3rem)] items-center px-4 py-6 md:px-6">
        <div className="mx-auto w-full max-w-lg" role={verificationFailed ? "alert" : undefined}>
          <ShieldWarningIcon aria-hidden="true" className="text-warning h-5 w-5" />
          <h1 className="text-fg mt-4 text-xl font-semibold">
            {verificationFailed ? "Council is temporarily unavailable" : "Council access required"}
          </h1>
          <p className="text-fg-muted mt-2 text-sm leading-6">
            {verificationFailed
              ? "We could not verify your Council permissions. Try again in a moment."
              : "Your account does not have permission to open the Council workspace."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {verificationFailed && (
              <Link
                href="/council"
                prefetch={false}
                className="bg-brand text-brand-fg duration-fast focus-visible:ring-border-focus focus-visible:ring-offset-bg inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
              >
                Try again
              </Link>
            )}
            <Link
              href="/"
              className="border-border text-fg-muted duration-fast hover:bg-surface hover:text-fg focus-visible:ring-border-focus focus-visible:ring-offset-bg inline-flex h-11 items-center justify-center rounded-md border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
            >
              Go home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col md:flex-row">
      <header className="border-border bg-surface border-b md:hidden">
        <div className="flex h-12 items-center gap-3 px-4">
          <Link
            href="/"
            className="text-fg-muted duration-fast hover:bg-bg-raised hover:text-fg focus-visible:ring-border-focus -ml-2 inline-flex h-11 w-11 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
            aria-label="Return to Mandaloria"
          >
            <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
          </Link>
          <span className="text-fg text-sm font-semibold">Council</span>
        </div>
        <div className="overflow-x-auto px-4 pb-2">
          <CouncilNavigation
            canManageCodex={access.canManageCodex}
            canManagePlazas={access.canManagePlazas}
            canManageSettings={access.canManageSettings}
            canViewAudit={access.canViewAudit}
            canViewReports={access.canViewReports}
            canViewUsers={access.canViewUsers}
            variant="horizontal"
          />
        </div>
      </header>

      <aside
        className="border-border bg-surface hidden w-56 shrink-0 border-r p-4 md:flex md:flex-col"
        aria-label="Council navigation"
      >
        <Link
          href="/"
          className="text-fg-muted duration-fast hover:bg-bg-raised hover:text-fg focus-visible:ring-border-focus -ml-3 inline-flex h-11 items-center gap-2 self-start rounded-md px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
        >
          <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
          Mandaloria
        </Link>

        <p className="text-fg mt-5 mb-2 text-sm font-semibold">Council</p>

        <CouncilNavigation
          canManageCodex={access.canManageCodex}
          canManagePlazas={access.canManagePlazas}
          canManageSettings={access.canManageSettings}
          canViewAudit={access.canViewAudit}
          canViewReports={access.canViewReports}
          canViewUsers={access.canViewUsers}
        />
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}
