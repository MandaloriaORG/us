import { forwardRef, type SelectHTMLAttributes } from "react";
import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr";

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
        <label className="text-fg text-sm font-medium" htmlFor={id}>
          {label}
        </label>
        <div className="relative">
          <select
            {...props}
            aria-describedby={describedBy || undefined}
            aria-invalid={error ? true : ariaInvalid}
            className={cn(
              "border-border bg-bg text-fg duration-fast h-11 w-full appearance-none rounded-md border px-3 pr-10 text-sm outline-hidden transition-colors",
              "hover:border-border-raised focus-visible:border-border-focus focus-visible:ring-border-focus/30 focus-visible:ring-2",
              "disabled:bg-surface disabled:text-fg-subtle disabled:cursor-not-allowed disabled:opacity-60",
              error && "border-error focus-visible:border-error focus-visible:ring-error/30",
              className,
            )}
            id={id}
            ref={ref}
          >
            {children}
          </select>
          <CaretDownIcon
            aria-hidden="true"
            className="text-fg-subtle pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2"
          />
        </div>
        {description ? (
          <p className="text-fg-muted text-xs" id={descriptionId}>
            {description}
          </p>
        ) : null}
        {error ? (
          <p className="text-error text-xs" id={errorId} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

NativeSelect.displayName = "NativeSelect";
