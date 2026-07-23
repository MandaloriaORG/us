import Link from "next/link";
import { CompassIcon } from "@phosphor-icons/react/dist/ssr";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="border-border bg-bg-raised mb-6 rounded-full border p-5">
        <CompassIcon className="text-fg-muted h-10 w-10" />
      </div>
      <h1 className="font-display text-fg text-4xl font-bold">Lost in wild space</h1>
      <p className="text-fg-muted mt-3 max-w-md">
        This sector of Mandaloria doesn&apos;t exist. The coordinates may be wrong or the route may
        have changed.
      </p>
      <Link
        href="/"
        className="bg-brand text-brand-fg duration-fast mt-8 inline-flex h-11 items-center gap-2 rounded-md px-6 text-sm font-medium transition-colors hover:opacity-90"
      >
        Return to Home
      </Link>
    </main>
  );
}
