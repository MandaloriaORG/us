"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer border-input data-[state=checked]:border-primary focus-visible:ring-ring/24 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground duration-fast hover:border-border-raised grid h-4 w-4 shrink-0 place-content-center rounded-md border shadow-xs/5 transition-[border-color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:shadow-[inset_0_1px_0_var(--color-white/12%)]",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("grid place-content-center text-current")}>
      <CheckIcon className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
