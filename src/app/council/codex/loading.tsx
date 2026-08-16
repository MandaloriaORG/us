import { Skeleton } from "@/components/ui/skeleton";

export default function CodexCouncilLoading() {
  return (
    <div>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="mt-4 h-11 w-full" />
      <div className="mt-6 flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
