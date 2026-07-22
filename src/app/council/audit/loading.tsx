import { Skeleton } from "@/components/ui/skeleton";

const AUDIT_ROW_SKELETONS = 7;

export default function AuditLoading() {
  return (
    <section aria-busy="true" aria-label="Loading audit log" className="space-y-6">
      <div aria-hidden="true" className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>

      <div aria-hidden="true" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>

      <div
        aria-hidden="true"
        className="max-w-full overflow-x-auto rounded-md border border-border"
      >
        <div className="min-w-[48rem]">
          <div className="grid h-11 grid-cols-[9rem_1fr_10rem_1fr_12rem] items-center gap-4 border-b border-border bg-surface px-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-3 w-16" />
            ))}
          </div>

          {Array.from({ length: AUDIT_ROW_SKELETONS }).map((_, index) => (
            <div
              key={index}
              className="grid min-h-14 grid-cols-[9rem_1fr_10rem_1fr_12rem] items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full max-w-40" />
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-4 w-full max-w-36" />
              <Skeleton className="h-4 w-full max-w-44" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
