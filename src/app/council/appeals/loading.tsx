import { Skeleton } from "@/components/ui/skeleton";

const APPEAL_ROW_SKELETONS = 6;

export default function CouncilAppealsLoading() {
  return (
    <section aria-busy="true" aria-label="Loading the appeal queue" className="space-y-6">
      <div aria-hidden="true" className="space-y-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>

      <div aria-hidden="true" className="space-y-3">
        {Array.from({ length: APPEAL_ROW_SKELETONS }).map((_, index) => (
          <div key={index} className="border-border space-y-2 border-b pb-3 last:border-b-0">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3 w-full max-w-sm" />
          </div>
        ))}
      </div>
    </section>
  );
}
