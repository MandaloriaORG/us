import { BookOpenIcon } from "@phosphor-icons/react/dist/ssr";
import { Skeleton } from "@/components/ui/skeleton";

export default function CodexLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="flex items-center gap-2">
        <BookOpenIcon aria-hidden="true" className="text-fg-muted h-5 w-5" />
        <Skeleton className="h-6 w-48" />
      </div>
      <Skeleton className="mt-4 h-11 w-full" />
      <div className="mt-6 flex flex-col gap-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}
