"use client";

import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { CircleAlert, Eye, EyeOff, Lock, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

export interface PasswordInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "type"
> {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  icon?: LucideIcon | null;
  fieldClassName?: string;
  showPasswordLabel?: string;
  hidePasswordLabel?: string;
}

/**
 * Origin UI/coss Field + Input Group adaptation for password entry.
 *
 * Use only when users must enter a password and benefit from revealing it.
 * Do not use for tokens, one-time codes, or ordinary text. The component keeps
 * the input first in keyboard order, provides a 44px reveal target with an
 * accessible state-dependent name, and links help/error text through
 * `aria-describedby`. It supports disabled/read-only/invalid states; consumers
 * retain ownership of validation and async form feedback.
 *
 * Source patterns:
 * https://coss.com/ui/docs/components/field
 * https://coss.com/ui/docs/components/input
 * https://coss.com/ui/docs/components/input-group
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      id,
      label,
      description,
      error,
      icon: Icon = Lock,
      fieldClassName,
      className,
      required,
      disabled,
      readOnly,
      showPasswordLabel = "Show password",
      hidePasswordLabel = "Hide password",
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      ...props
    },
    ref,
  ) => {
    const [isVisible, setIsVisible] = useState(false);
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
            type={isVisible ? "text" : "password"}
            required={required}
            disabled={disabled}
            readOnly={readOnly}
            aria-describedby={describedBy}
            aria-invalid={error ? true : ariaInvalid}
            className={cn(
              "h-11 w-full rounded-md border border-border bg-bg px-3 pr-12 text-sm text-fg outline-none",
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
          <button
            type="button"
            disabled={disabled || readOnly}
            aria-label={isVisible ? hidePasswordLabel : showPasswordLabel}
            aria-pressed={isVisible}
            onClick={() => setIsVisible((current) => !current)}
            className={cn(
              "absolute right-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md",
              "text-fg-muted outline-none transition-colors duration-fast hover:text-fg",
              "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            {isVisible ? (
              <EyeOff aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Eye aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
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

PasswordInput.displayName = "PasswordInput";
