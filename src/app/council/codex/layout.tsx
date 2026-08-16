import type { Metadata } from "next";
import Link from "next/link";
import { ShieldWarningIcon } from "@phosphor-icons/react/dist/ssr";

import { getCodexCouncilAccess } from "@/app/council/codex/codex-access";
import { CodexCouncilNav } from "@/app/council/codex/codex-council-nav";

export const metadata: Metadata = {
  title: "Codex · Council",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CodexCouncilLayout({ children }: { children: React.ReactNode }) {
  const access = await getCodexCouncilAccess();

  if (!access.allowed) {
    const verificationFailed = access.reason === "verification_failed";
    return (
      <section>
        <div role={verificationFailed ? "alert" : undefined} className="mx-auto max-w-lg py-10">
          <ShieldWarningIcon aria-hidden="true" className="text-warning h-5 w-5" />
          <h1 className="text-fg mt-3 text-xl font-semibold">
            {verificationFailed
              ? "Codex work is temporarily unavailable"
              : "Archivist access required"}
          </h1>
          <p className="text-fg-muted mt-2 text-sm leading-6">
            {verificationFailed
              ? "We could not verify your Codex permissions. Try again in a moment."
              : "Writing to Codex Libre needs the codex.edit permission, held by Archivists and administrators."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {verificationFailed ? (
              <Link
                href="/council/codex"
                className="bg-brand text-brand-fg duration-fast focus-visible:ring-border-focus inline-flex h-11 items-center rounded-md px-4 text-sm font-medium transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-hidden"
              >
                Try again
              </Link>
            ) : null}
            <Link
              href="/council"
              className="border-border text-fg-muted duration-fast hover:bg-surface hover:text-fg focus-visible:ring-border-focus inline-flex h-11 items-center rounded-md border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
            >
              Back to Council
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="border-border flex flex-col gap-3 border-b pb-4">
        <div>
          <h1 className="text-fg text-xl font-semibold">Codex Libre</h1>
          <p className="text-fg-muted mt-1 text-sm">
            Write, review and publish the community&apos;s knowledge.
          </p>
        </div>
        <CodexCouncilNav />
      </div>
      <div className="pt-4">{children}</div>
    </div>
  );
}
