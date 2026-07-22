import { Skeleton } from "@/components/ui/skeleton";

export default function MembersLoading() {
  return (
    <main aria-busy="true" aria-label="Loading members" className="mx-auto max-w-3xl px-6 py-12">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="mt-3 h-4 max-w-md" variant="text" />
      <div className="mt-8 divide-y divide-border rounded-md border border-border">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-10 w-10" variant="circular" />
            <div className="flex-1 space-y-2">
              <Skeleton className="max-w-40" variant="text" />
              <Skeleton className="max-w-64" variant="text" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
