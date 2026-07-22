import { MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function PlazasPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <EmptyState
        icon={<MessageSquare className="h-10 w-10" />}
        title="Plazas"
        description="Durable discussion spaces organized by topic. This is where the community gathers to debate, share, and build knowledge."
        action={{
          label: "Coming soon",
          href: "/",
        }}
      />
    </main>
  );
}
