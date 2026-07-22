import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileEditLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading profile editor"
      className="mx-auto max-w-xl px-6 py-12"
    >
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-3 max-w-72" variant="text" />
      <div className="mt-8 space-y-6">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-28" variant="text" />
            <Skeleton className={index === 1 ? "h-28" : "h-11"} />
          </div>
        ))}
        <Skeleton className="h-11 w-36" />
      </div>
    </main>
  );
}
