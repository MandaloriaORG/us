import { Skeleton } from "@/components/ui/skeleton";

export default function MembersLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading members"
      className="mx-auto w-full max-w-5xl px-6 py-12"
    >
      <Skeleton className="h-8 w-32" />
      <Skeleton className="mt-3 h-4 max-w-md" variant="text" />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="border-border bg-bg-raised rounded-lg border p-5">
            <div className="flex items-start gap-4">
              <Skeleton className="h-12 w-12" variant="circular" />
              <div className="flex-1 space-y-2">
                <Skeleton className="max-w-40" variant="text" />
                <Skeleton className="max-w-24" variant="text" />
                <Skeleton className="max-w-56" variant="text" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
