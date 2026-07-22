import { CapabilityList } from "@/components/marketing/capability-list";
import { PublicHero } from "@/components/marketing/public-hero";
import { KnowledgePipeline } from "@/components/system/knowledge-pipeline";

export default function HomePage() {
  return (
    <main className="min-h-[calc(100svh-3rem)]">
      <PublicHero visual={<KnowledgePipeline />} />
      <CapabilityList />
    </main>
  );
}
