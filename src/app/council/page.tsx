import { Shield, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CouncilPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 rounded-full border border-error/30 bg-error/10 p-5">
        <Shield className="h-10 w-10 text-error" />
      </div>
      <h1 className="font-display text-3xl font-bold text-fg">Access Restricted</h1>
      <p className="mt-3 max-w-md text-fg-muted">
        The Council is only accessible to authorized members. If you believe you should have access,
        contact an administrator.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-11 items-center gap-2 rounded-md border border-border px-6 text-sm font-medium text-fg transition-colors duration-fast hover:bg-surface"
      >
        <ArrowLeft className="h-4 w-4" />
        Return to Home
      </Link>
    </main>
  );
}
