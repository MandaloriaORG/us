import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the message feed only. The channel rail and shell live in
 * the persistent `(channel)` layout and never skeleton — only the feed area
 * that is actually being (re)loaded shows placeholders.
 */
export default function ChannelLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border bg-bg-raised flex items-start justify-between gap-3 border-b px-4 py-2.5">
        <div className="w-full max-w-64">
          <Skeleton variant="text" className="h-5 w-36" />
          <Skeleton variant="text" className="mt-2 h-3.5 w-52" />
        </div>
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} variant="text" className="h-12" />
        ))}
      </div>
    </div>
  );
}
