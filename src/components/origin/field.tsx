"use client";

import { Field as FieldPrimitive } from "@base-ui/react/field";
import type React from "react";
import { cn } from "@/lib/cn";

export function Field({ className, ...props }: FieldPrimitive.Root.Props): React.ReactElement {
  return (
    <FieldPrimitive.Root
      className={cn("flex flex-col items-start gap-2", className)}
      data-slot="field"
      {...props}
    />
  );
}

export function FieldLabel({
  className,
  ...props
}: FieldPrimitive.Label.Props): React.ReactElement {
  return (
    <FieldPrimitive.Label
      className={cn(
        "text-foreground inline-flex items-center gap-2 text-base/4.5 font-medium data-disabled:opacity-64 sm:text-sm/4",
        className,
      )}
      data-slot="field-label"
      {...props}
    />
  );
}

export function FieldItem({ className, ...props }: FieldPrimitive.Item.Props): React.ReactElement {
  return (
    <FieldPrimitive.Item className={cn("flex", className)} data-slot="field-item" {...props} />
  );
}

export function FieldDescription({
  className,
  ...props
}: FieldPrimitive.Description.Props): React.ReactElement {
  return (
    <FieldPrimitive.Description
      className={cn("text-muted-foreground text-xs", className)}
      data-slot="field-description"
      {...props}
    />
  );
}

/**
 * Base UI's `Field.Error` renders only when Base UI owns the field's validity,
 * and it stays empty for anything else — which silently drops the message and
 * strips the control's accessible description. Mandaloria's validity is decided
 * on the server, by a Server Action result or a database rejection, so the error
 * is rendered directly here. The `id` matters: the control points at it through
 * `aria-describedby`.
 */
export function FieldError({ className, ...props }: React.ComponentProps<"p">): React.ReactElement {
  return (
    <p
      className={cn("text-destructive-foreground text-xs", className)}
      data-slot="field-error"
      {...props}
    />
  );
}

export const FieldControl: typeof FieldPrimitive.Control = FieldPrimitive.Control;
export const FieldValidity: typeof FieldPrimitive.Validity = FieldPrimitive.Validity;

export { FieldPrimitive };
