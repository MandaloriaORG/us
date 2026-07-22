import { Skeleton } from "@/components/ui/skeleton";

export default function CouncilLoading() {
  return (
    <div aria-busy="true" aria-label="Loading Council users" className="space-y-6">
      <div aria-hidden="true" className="space-y-2">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-full max-w-64" />
      </div>

      <Skeleton aria-hidden="true" className="h-11 w-full max-w-sm" />

      <div aria-hidden="true">
        <div className="rounded-md border border-border">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex min-h-16 items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
            >
              <Skeleton variant="circular" className="h-10 w-10" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-full max-w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
