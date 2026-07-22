import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/cn";

export interface NativeSelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "id" | "size"
> {
  id: string;
  label: string;
  description?: string;
  error?: string;
  fieldClassName?: string;
}

/**
 * Origin/coss Field adaptation around a native select element.
 *
 * Use for short, static option sets where the platform picker is desirable.
 * Do not use for searchable, multi-select, grouped, or remote datasets. The
 * consumer controls responsive width; this component provides a compact 44px
 * target, visible label, native keyboard/mobile behavior, and linked
 * description/error feedback. Supply `error` only after user interaction.
 *
 * @see https://coss.com/ui/docs/components/field
 */
export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(
  (
    {
      id,
      label,
      description,
      error,
      fieldClassName,
      className,
      children,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      ...props
    },
    ref,
  ) => {
    const descriptionId = description ? `${id}-description` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy = [ariaDescribedBy, descriptionId, errorId].filter(Boolean).join(" ");

    return (
      <div className={cn("flex w-full flex-col gap-2", fieldClassName)}>
        <label className="text-sm font-medium text-fg" htmlFor={id}>
          {label}
        </label>
        <div className="relative">
          <select
            {...props}
            aria-describedby={describedBy || undefined}
            aria-invalid={error ? true : ariaInvalid}
            className={cn(
              "h-11 w-full appearance-none rounded-md border border-border bg-bg px-3 pr-10 text-sm text-fg outline-none transition-colors duration-fast",
              "hover:border-border-raised focus-visible:border-border-focus focus-visible:ring-2 focus-visible:ring-border-focus/30",
              "disabled:cursor-not-allowed disabled:bg-surface disabled:text-fg-subtle disabled:opacity-60",
              error && "border-error focus-visible:border-error focus-visible:ring-error/30",
              className,
            )}
            id={id}
            ref={ref}
          >
            {children}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
          />
        </div>
        {description ? (
          <p className="text-xs text-fg-muted" id={descriptionId}>
            {description}
          </p>
        ) : null}
        {error ? (
          <p className="text-xs text-error" id={errorId} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

NativeSelect.displayName = "NativeSelect";
