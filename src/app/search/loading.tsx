import { Skeleton } from "@/components/ui/skeleton";

export default function SearchLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading search"
      className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6"
    >
      <div aria-hidden="true" className="space-y-2">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>

      <div
        aria-hidden="true"
        className="border-border mt-6 grid gap-3 border-y py-4 md:grid-cols-2 2xl:grid-cols-[minmax(16rem,1fr)_10rem_12rem_11rem_12rem_auto] 2xl:items-end"
      >
        <Skeleton className="h-11 w-full md:col-span-2 2xl:col-span-1" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-24" />
      </div>

      <div aria-hidden="true" className="border-border mt-4 border-b">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="border-border border-t py-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-2/3 max-w-72" />
            </div>
            <Skeleton className="mt-2 h-3 w-full max-w-md" />
            <Skeleton className="mt-2 h-3 w-40" />
          </div>
        ))}
      </div>
    </main>
  );
}
