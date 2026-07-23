"use client";

import { forwardRef, useState, type ReactNode } from "react";
import { EyeIcon, EyeSlashIcon, LockIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/origin/field";
import { Input, type InputProps } from "@/components/origin/input";
import { cn } from "@/lib/cn";

export interface PasswordInputProps extends Omit<InputProps, "id" | "size" | "type"> {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  icon?: PhosphorIcon | null;
  fieldClassName?: string;
  showPasswordLabel?: string;
  hidePasswordLabel?: string;
}

/**
 * Password field composed on top of coss Field + Input, with a reveal toggle.
 * Use only when users must enter a password and benefit from revealing it.
 * Not for tokens, one-time codes, or ordinary text.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    {
      id,
      label,
      description,
      error,
      icon: Icon = LockIcon,
      fieldClassName,
      className,
      required,
      disabled,
      readOnly,
      showPasswordLabel = "Show password",
      hidePasswordLabel = "Hide password",
      ...props
    },
    ref,
  ) {
    const [isVisible, setIsVisible] = useState(false);
    const descriptionId = description ? `${id}-description` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy =
      [props["aria-describedby"], descriptionId, errorId].filter(Boolean).join(" ") || undefined;

    return (
      <Field className={cn("w-full gap-1.5", fieldClassName)}>
        <FieldLabel htmlFor={id}>
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
        </FieldLabel>

        <div className="relative w-full">
          <Input
            ref={ref}
            id={id}
            type={isVisible ? "text" : "password"}
            required={required}
            disabled={disabled}
            readOnly={readOnly}
            aria-invalid={error ? true : props["aria-invalid"]}
            aria-describedby={describedBy}
            className={cn(Icon && "[&_input]:ps-10", "[&_input]:pe-12", className)}
            {...props}
          />
          {Icon ? (
            <Icon
              aria-hidden="true"
              className="text-fg-muted pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            />
          ) : null}
          <button
            type="button"
            disabled={disabled || readOnly}
            aria-label={isVisible ? hidePasswordLabel : showPasswordLabel}
            aria-pressed={isVisible}
            onClick={() => setIsVisible((current) => !current)}
            className={cn(
              "absolute top-1/2 right-0 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md",
              "text-fg-muted hover:text-fg outline-hidden transition-colors",
              "focus-visible:ring-border-focus focus-visible:ring-2 focus-visible:ring-inset",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            {isVisible ? (
              <EyeSlashIcon aria-hidden="true" className="h-4 w-4" />
            ) : (
              <EyeIcon aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        </div>

        {description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
        {error ? (
          <FieldError id={errorId} className="flex items-start gap-1.5">
            <WarningCircleIcon aria-hidden="true" className="mt-px h-4 w-4 shrink-0" />
            <span>{error}</span>
          </FieldError>
        ) : null}
      </Field>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
