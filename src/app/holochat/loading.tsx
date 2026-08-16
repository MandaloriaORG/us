import { Skeleton } from "@/components/ui/skeleton";

export default function HolochatLoading() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="w-full max-w-64">
          <Skeleton variant="text" className="h-6 w-32" />
          <Skeleton variant="text" className="mt-2 h-4 w-48" />
        </div>
        <Skeleton className="h-11 w-11 rounded-md" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} variant="text" className="h-12" />
        ))}
      </div>
    </div>
  );
}
