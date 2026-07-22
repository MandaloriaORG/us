import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 rounded-full border border-border bg-bg-raised p-5">
        <Compass className="h-10 w-10 text-fg-muted" />
      </div>
      <h1 className="font-display text-4xl font-bold text-fg">Lost in wild space</h1>
      <p className="mt-3 max-w-md text-fg-muted">
        This sector of Mandaloria doesn&apos;t exist. The coordinates may be wrong or the route may
        have changed.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-11 items-center gap-2 rounded-md bg-brand px-6 text-sm font-medium text-brand-fg transition-colors duration-fast hover:opacity-90"
      >
        Return to Home
      </Link>
    </main>
  );
}
