import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading site settings"
      className="mx-auto w-full max-w-4xl space-y-6"
    >
      <div aria-hidden="true" className="space-y-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>

      <div aria-hidden="true" className="space-y-6">
        {Array.from({ length: 2 }).map((_, sectionIndex) => (
          <div key={sectionIndex} className="space-y-3">
            <Skeleton className="h-6 w-32" />
            <div className="border-border border-t">
              {Array.from({ length: 3 }).map((_, rowIndex) => (
                <div
                  key={rowIndex}
                  className="border-border flex flex-col gap-3 border-b py-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-full max-w-64" />
                  </div>
                  <div className="flex items-center justify-end gap-3 sm:min-w-72">
                    <Skeleton className="h-8 w-full sm:w-40" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
