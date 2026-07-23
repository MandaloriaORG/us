import Link from "next/link";
import { ShieldIcon } from "@phosphor-icons/react/dist/ssr";

interface AuthShellProps {
  children: React.ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <main className="flex min-h-[calc(100svh-4rem)] items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Link
            href="/"
            aria-label="Mandaloria home"
            className="border-brand/40 text-brand duration-fast hover:bg-brand-muted/10 focus:ring-border-focus focus:ring-offset-bg inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
          >
            <ShieldIcon aria-hidden="true" className="h-6 w-6" />
          </Link>
        </div>
        {children}
      </div>
    </main>
  );
}
