"use client";

import { forwardRef } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/origin/field";
import { Input, type InputProps } from "@/components/origin/input";
import { cn } from "@/lib/cn";

export interface SearchInputProps extends Omit<InputProps, "id" | "size" | "type"> {
  id: string;
  label: string;
  description?: string;
  error?: string;
  fieldClassName?: string;
}

/**
 * Search field composed on top of coss Field + Input, `type="search"` + leading
 * magnifier. Use for ordinary search/filter inputs with a visible label. Not
 * for command palettes, autocomplete, or async suggestions.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { id, label, description, error, fieldClassName, className, ...props },
  ref,
) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [props["aria-describedby"], descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <Field className={cn("w-full gap-1.5", fieldClassName)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative w-full">
        <Input
          ref={ref}
          id={id}
          type="search"
          aria-invalid={error ? true : props["aria-invalid"]}
          aria-describedby={describedBy}
          className={cn("[&_input]:ps-10", className)}
          {...props}
        />
        <MagnifyingGlassIcon
          aria-hidden="true"
          className="text-fg-subtle pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
        />
      </div>
      {description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
      {error ? (
        <FieldError id={errorId} role="alert">
          {error}
        </FieldError>
      ) : null}
    </Field>
  );
});
SearchInput.displayName = "SearchInput";
