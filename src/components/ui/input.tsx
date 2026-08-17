import * as React from "react";

import { cn } from "@/lib/cn";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "border-input file:text-foreground placeholder:text-muted-foreground focus-visible:ring-ring/24 bg-background duration-fast hover:border-border-raised flex h-9 w-full rounded-lg border px-3 py-1 text-base shadow-[var(--shadow-xs),inset_0_1px_0_var(--color-black/4%)] transition-[border-color,box-shadow] file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-64 md:text-sm dark:shadow-[var(--shadow-xs),inset_0_-1px_0_var(--color-white/6%)]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
