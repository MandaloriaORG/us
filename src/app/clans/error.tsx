"use client";

import { ShieldIcon } from "@phosphor-icons/react/dist/ssr";
import { EmptyState } from "@/components/ui/empty-state";

export default function ClansError() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div role="alert">
        <EmptyState
          icon={<ShieldIcon className="h-8 w-8" />}
          title="Something went wrong"
          description="We could not load this page. Try again in a moment."
          action={{ label: "Try again", href: "/clans" }}
        />
      </div>
    </main>
  );
}
