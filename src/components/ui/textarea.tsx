import * as React from "react";

import { cn } from "@/lib/cn";

/**
 * Textarea del sistema visual unificado (lane K): mismo lenguaje que `ui/input`
 * — rounded-lg, focus ring 3px, hover border-raised, inset shadow. Reemplaza
 * las clases TEXTAREA_CLASS sueltas y los <textarea> nativos de los forms.
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "border-input placeholder:text-muted-foreground focus-visible:ring-ring/24 bg-background duration-fast hover:border-border-raised w-full rounded-lg border px-3 py-2 text-base shadow-[var(--shadow-xs),inset_0_1px_0_var(--color-black/4%)] transition-[border-color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-64 dark:shadow-[var(--shadow-xs),inset_0_-1px_0_var(--color-white/6%)] md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };