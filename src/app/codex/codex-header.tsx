import Link from "next/link";
import { BookOpenIcon } from "@phosphor-icons/react/dist/ssr";

import { CodexNav } from "@/app/codex/codex-nav";

export function CodexHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="border-border flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <Link
          href="/codex"
          className="text-fg hover:text-brand focus-visible:ring-border-focus focus-visible:ring-2 focus-visible:outline-hidden inline-flex items-center gap-2.5"
        >
          <span className="border-brand/25 bg-brand/5 text-brand flex h-9 w-9 items-center justify-center rounded-lg border shadow-[0_1px_0_var(--color-white/8%)]">
            <BookOpenIcon aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="font-display bg-linear-to-r from-brand to-amber-200 bg-clip-text text-2xl font-semibold tracking-tight text-transparent">
            Codex Libre
          </span>
        </Link>
        <p className="text-fg-muted mt-1.5 text-sm leading-6">
          Reviewed, versioned knowledge distilled from Mandaloria&apos;s conversations.
        </p>
      </div>
      <CodexNav signedIn={signedIn} />
    </header>
  );
}
