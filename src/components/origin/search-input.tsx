import { forwardRef, type InputHTMLAttributes } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/cn";

export interface SearchInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "size" | "type"
> {
  id: string;
  label: string;
  description?: string;
  error?: string;
  fieldClassName?: string;
}

/**
 * Origin/coss adaptation of Input + Input Group + Field for text filtering.
 *
 * Use for ordinary search/filter fields with a visible label. Do not use for
 * command palettes, autocomplete, or async suggestions. The consumer controls
 * responsive width; this component provides a compact 44px control, native
 * disabled state, and linked description/error feedback. Supply `error` only
 * after validation or submission so untouched fields stay quiet.
 *
 * @see https://coss.com/ui/docs/components/input
 * @see https://coss.com/ui/docs/components/input-group
 * @see https://coss.com/ui/docs/components/field
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      id,
      label,
      description,
      error,
      fieldClassName,
      className,
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
          <input
            {...props}
            aria-describedby={describedBy || undefined}
            aria-invalid={error ? true : ariaInvalid}
            className={cn(
              "h-11 w-full rounded-md border border-border bg-bg px-3 pl-10 text-sm text-fg outline-none transition-colors duration-fast placeholder:text-fg-subtle",
              "hover:border-border-raised focus-visible:border-border-focus focus-visible:ring-2 focus-visible:ring-border-focus/30",
              "disabled:cursor-not-allowed disabled:bg-surface disabled:text-fg-subtle disabled:opacity-60",
              error && "border-error focus-visible:border-error focus-visible:ring-error/30",
              className,
            )}
            id={id}
            ref={ref}
            type="search"
          />
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
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

SearchInput.displayName = "SearchInput";
