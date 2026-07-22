import { cn } from "@/lib/cn";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular";
}

export function Skeleton({ className, variant = "rectangular", ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-surface-raised",
        {
          "h-4 w-full": variant === "text",
          "rounded-full": variant === "circular",
        },
        className,
      )}
      {...props}
    />
  );
}
