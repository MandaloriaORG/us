import { MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function HolochatPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <EmptyState
        icon={<MessageCircle className="h-10 w-10" />}
        title="Holochat"
        description="Live conversation channels for daily coexistence. Real-time chat coming in a future phase."
        action={{
          label: "Coming soon",
          href: "/",
        }}
      />
    </main>
  );
}
