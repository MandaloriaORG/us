"use client";

import { forwardRef, type ReactNode } from "react";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/origin/field";
import { Input, type InputProps } from "@/components/origin/input";
import { cn } from "@/lib/cn";

export interface TextInputProps extends Omit<InputProps, "id" | "size"> {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  icon?: PhosphorIcon;
  fieldClassName?: string;
}

/**
 * Labelled single-line text field composed on top of coss (Origin UI) Base UI
 * Field + Input primitives. Adds Mandaloria icon slot, required-star, inline
 * error. Use for a single-line value that needs a visible label and local
 * validation; not for passwords, multiline, or unlabeled toolbars.
 */
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { id, label, description, error, icon: Icon, fieldClassName, className, required, ...props },
  ref,
) {
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
          required={required}
          aria-invalid={error ? true : props["aria-invalid"]}
          aria-describedby={describedBy}
          className={cn(Icon && "[&_input]:ps-10", className)}
          {...props}
        />
        {Icon ? (
          <Icon
            aria-hidden="true"
            className="text-fg-muted pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          />
        ) : null}
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
});
TextInput.displayName = "TextInput";
