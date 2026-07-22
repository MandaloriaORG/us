import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { CircleAlert, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  icon?: LucideIcon;
  fieldClassName?: string;
}

/**
 * Origin UI/coss Field + Input + Input Group adaptation for Mandaloria.
 *
 * Use for a single-line value that needs a visible label and local validation.
 * Do not use for passwords, multiline content, search toolbars, or unlabeled
 * icon-only controls. The component supports optional help/error states,
 * disabled/read-only inputs, and a decorative leading icon. It links every
 * message through `aria-describedby`, exposes invalid state to assistive
 * technology, and keeps a 44px control height at all viewport sizes.
 *
 * Source patterns:
 * https://coss.com/ui/docs/components/field
 * https://coss.com/ui/docs/components/input
 * https://coss.com/ui/docs/components/input-group
 */
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      id,
      label,
      description,
      error,
      icon: Icon,
      fieldClassName,
      className,
      required,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      ...props
    },
    ref,
  ) => {
    const descriptionId = description ? `${id}-description` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy =
      [ariaDescribedBy, descriptionId, errorId].filter(Boolean).join(" ") || undefined;

    return (
      <div className={cn("flex w-full flex-col gap-1.5", fieldClassName)}>
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {label}
          {required ? (
            <>
              <span aria-hidden="true" className="text-error">
                {" "}
                *
              </span>
              <span className="sr-only"> (required)</span>
            </>
          ) : null}
        </label>

        <div className="relative">
          <input
            {...props}
            ref={ref}
            id={id}
            required={required}
            aria-describedby={describedBy}
            aria-invalid={error ? true : ariaInvalid}
            className={cn(
              "h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg outline-none",
              "transition-colors duration-fast placeholder:text-fg-subtle",
              "focus-visible:border-border-focus focus-visible:ring-2 focus-visible:ring-border-focus/40",
              "read-only:bg-bg-raised disabled:cursor-not-allowed disabled:opacity-50",
              "aria-[invalid=true]:border-error aria-[invalid=true]:focus-visible:ring-error/30",
              Icon && "pl-10",
              className,
            )}
          />
          {Icon ? (
            <Icon
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted"
            />
          ) : null}
        </div>

        {description ? (
          <p id={descriptionId} className="text-xs text-fg-muted">
            {description}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} className="flex items-start gap-1.5 text-xs text-error">
            <CircleAlert aria-hidden="true" className="mt-px h-4 w-4 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    );
  },
);

TextInput.displayName = "TextInput";
