import Link from "next/link";
import { BookOpenIcon } from "@phosphor-icons/react/dist/ssr";

import { CodexNav } from "@/app/codex/codex-nav";

export function CodexHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="border-border flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <Link
          href="/codex"
          className="text-fg hover:text-brand focus-visible:ring-border-focus inline-flex items-center gap-2 text-xl font-semibold focus-visible:ring-2 focus-visible:outline-hidden"
        >
          <BookOpenIcon aria-hidden="true" className="h-5 w-5" />
          Codex Libre
        </Link>
        <p className="text-fg-muted mt-1 text-sm">
          Reviewed, versioned knowledge distilled from Mandaloria&apos;s conversations.
        </p>
      </div>
      <CodexNav signedIn={signedIn} />
    </header>
  );
}
