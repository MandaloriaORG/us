import { Shield } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function ClansPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <EmptyState
        icon={<Shield className="h-10 w-10" />}
        title="Clans & Houses"
        description="Belong to a community structure. Earn ranks, badges, and take responsibility for areas of knowledge."
        action={{
          label: "Coming soon",
          href: "/",
        }}
      />
    </main>
  );
}
