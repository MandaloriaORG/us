import { BookOpen } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function CodexPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <EmptyState
        icon={<BookOpen className="h-10 w-10" />}
        title="Codex Libre"
        description="The community's preserved knowledge. Articles are reviewed, versioned, and linked to their source conversations."
        action={{
          label: "Coming soon",
          href: "/",
        }}
      />
    </main>
  );
}
