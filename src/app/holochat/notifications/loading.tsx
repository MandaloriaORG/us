import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-10 px-4 py-6 md:px-6">
      <div>
        <Skeleton variant="text" className="h-6 w-40" />
        <Skeleton variant="text" className="mt-2 h-4 w-64" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton variant="text" className="h-4 w-24" />
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} variant="text" className="h-14" />
        ))}
      </div>
    </div>
  );
}
