import Link from "next/link";
import { Shield } from "lucide-react";

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
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-brand/40 text-brand transition-colors duration-fast hover:bg-brand-muted/10 focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2 focus:ring-offset-bg"
          >
            <Shield aria-hidden="true" className="h-6 w-6" />
          </Link>
        </div>
        {children}
      </div>
    </main>
  );
}
