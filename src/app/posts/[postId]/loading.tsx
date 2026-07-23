import { Skeleton } from "@/components/ui/skeleton";

/**
 * DESIGN — owned by the UI workstream: the skeleton must match the shape of the
 * result it replaces, so a row list stays a row list. Do not add a spinner and
 * do not let it flash for a fast response.
 */
export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading" className="mx-auto w-full max-w-3xl px-4 py-6">
      <Skeleton className="h-8 w-40" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-16" />
        ))}
      </div>
    </main>
  );
}
