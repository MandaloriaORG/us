import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-border-focus/24 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "border border-brand/30 bg-linear-to-b from-brand to-brand-deep text-brand-fg shadow-md before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_0_var(--color-white/10%)] hover:border-brand/50 hover:brightness-105",
        secondary:
          "border border-border bg-bg-raised text-fg shadow-xs/5 hover:bg-surface hover:border-border-raised before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_0_var(--color-white/6%)] dark:before:shadow-[0_-1px_0_var(--color-white/4%)]",
        ghost: "text-fg-muted hover:text-fg hover:bg-surface",
        destructive: "border border-error/30 bg-error/20 text-error hover:bg-error/30",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-11 px-5",
        lg: "h-12 px-6 text-base",
        icon: "h-11 w-11",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

/**
 * shadcn/Radix Slot adaptation using Mandaloria tokens and interaction states.
 * Use for actions and action-like links; use a normal Link for navigation that
 * should read as inline text. The consumer owns pending/error announcements and
 * must provide an accessible name for icon-only buttons.
 *
 * @see https://ui.shadcn.com/docs/components/button
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = Boolean(disabled || loading);

    return (
      <Comp
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...(asChild ? { "aria-disabled": isDisabled || undefined } : { disabled: isDisabled })}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <CircleNotchIcon aria-hidden="true" className="h-4 w-4 animate-spin" />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
