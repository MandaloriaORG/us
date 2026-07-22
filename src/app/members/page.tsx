import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function MembersPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <EmptyState
        icon={<Users className="h-10 w-10" />}
        title="Members"
        description="The Mandalorian community. Profiles, ranks, badges, and clan affiliations."
        action={{
          label: "Coming soon",
          href: "/",
        }}
      />
    </main>
  );
}
