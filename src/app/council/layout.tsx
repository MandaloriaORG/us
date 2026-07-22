import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
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
          <ShieldAlert aria-hidden="true" className="h-5 w-5 text-warning" />
          <h1 className="mt-4 text-xl font-semibold text-fg">
            {verificationFailed ? "Council is temporarily unavailable" : "Council access required"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-fg-muted">
            {verificationFailed
              ? "We could not verify your Council permissions. Try again in a moment."
              : "Your account does not have permission to open the Council workspace."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {verificationFailed && (
              <Link
                href="/council"
                prefetch={false}
                className="inline-flex h-11 items-center justify-center rounded-md bg-brand px-4 text-sm font-medium text-brand-fg transition-colors duration-fast hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                Try again
              </Link>
            )}
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-fg-muted transition-colors duration-fast hover:bg-surface hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
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
      <header className="border-b border-border bg-surface md:hidden">
        <div className="flex h-12 items-center gap-3 px-4">
          <Link
            href="/"
            className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-md text-fg-muted transition-colors duration-fast hover:bg-bg-raised hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            aria-label="Return to Mandaloria"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          </Link>
          <span className="text-sm font-semibold text-fg">Council</span>
        </div>
        <div className="overflow-x-auto px-4 pb-2">
          <CouncilNavigation
            canViewAudit={access.canViewAudit}
            canViewUsers={access.canViewUsers}
            variant="horizontal"
          />
        </div>
      </header>

      <aside
        className="hidden w-56 shrink-0 border-r border-border bg-surface p-4 md:flex md:flex-col"
        aria-label="Council navigation"
      >
        <Link
          href="/"
          className="-ml-3 inline-flex h-11 items-center gap-2 self-start rounded-md px-3 text-sm text-fg-muted transition-colors duration-fast hover:bg-bg-raised hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Mandaloria
        </Link>

        <p className="mb-2 mt-5 text-sm font-semibold text-fg">Council</p>

        <CouncilNavigation canViewAudit={access.canViewAudit} canViewUsers={access.canViewUsers} />
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}
