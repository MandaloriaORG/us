"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/cn";
import { Input, type InputProps } from "@/components/origin/input";
import { Textarea, type TextareaProps } from "@/components/origin/textarea";

const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text select-none items-center justify-center gap-2 leading-none [&>kbd]:rounded-[calc(var(--radius)-5px)] [&_svg:not([class*='size-'])]:in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:size-4.5 sm:[&_svg:not([class*='size-'])]:in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:size-4 [&_svg]:-mx-0.5 [svg:not([class*='opacity-'])]:**:not-has-[button]:opacity-80",
  {
    defaultVariants: {
      align: "inline-start",
    },
    variants: {
      align: {
        "block-end":
          "order-last w-full justify-start px-[calc(--spacing(3)-1px)] pb-[calc(--spacing(3)-1px)] [.border-t]:pt-[calc(--spacing(3)-1px)] [[data-size=sm]+&]:px-[calc(--spacing(2.5)-1px)]",
        "block-start":
          "order-first w-full justify-start px-[calc(--spacing(3)-1px)] pt-[calc(--spacing(3)-1px)] [.border-b]:pb-[calc(--spacing(3)-1px)] [[data-size=sm]+&]:px-[calc(--spacing(2.5)-1px)]",
        "inline-end":
          "order-last pe-[calc(--spacing(3)-1px)] has-[>:last-child[data-slot=badge]]:-me-1.5 has-[>button]:-me-2 has-[>kbd:last-child]:me-[-0.35rem] [[data-size=sm]+&]:pe-[calc(--spacing(2.5)-1px)]",
        "inline-start":
          "order-first ps-[calc(--spacing(3)-1px)] has-[>:last-child[data-slot=badge]]:-ms-1.5 has-[>button]:-ms-2 has-[>kbd:last-child]:ms-[-0.35rem] [[data-size=sm]+&]:ps-[calc(--spacing(2.5)-1px)]",
      },
    },
  },
);

export function InputGroup({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "border-input bg-background text-foreground ring-ring/24 has-[input:focus-visible,textarea:focus-visible]:has-[input[aria-invalid],textarea[aria-invalid]]:border-destructive/64 has-[input:focus-visible,textarea:focus-visible]:has-[input[aria-invalid],textarea[aria-invalid]]:ring-destructive/16 has-[input:focus-visible,textarea:focus-visible]:border-ring has-[input[aria-invalid],textarea[aria-invalid]]:border-destructive/36 has-autofill:bg-foreground/4 dark:bg-input/32 dark:has-autofill:bg-foreground/8 dark:has-[input[aria-invalid],textarea[aria-invalid]]:ring-destructive/24 relative inline-flex w-full min-w-0 items-center rounded-lg border text-base shadow-xs/5 transition-shadow not-dark:bg-clip-padding before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-has-[input:disabled,textarea:disabled]:not-has-[input:focus-visible,textarea:focus-visible]:not-has-[input[aria-invalid],textarea[aria-invalid]]:before:shadow-[0_1px_--theme(--color-black/4%)] has-data-[align=block-end]:h-auto has-data-[align=block-end]:flex-col has-data-[align=block-start]:h-auto has-data-[align=block-start]:flex-col has-[input:disabled,textarea:disabled]:opacity-64 has-[input:disabled,textarea:disabled,input:focus-visible,textarea:focus-visible,input[aria-invalid],textarea[aria-invalid]]:shadow-none has-[input:focus-visible,textarea:focus-visible]:ring-[3px] has-[textarea]:h-auto sm:text-sm dark:not-has-[input:disabled,textarea:disabled]:not-has-[input:focus-visible,textarea:focus-visible]:not-has-[input[aria-invalid],textarea[aria-invalid]]:before:shadow-[0_-1px_--theme(--color-white/6%)] [[data-size=sm]_input]:**:has-data-[align=inline-end]:pe-1.5 [[data-size=sm]_input]:**:has-data-[align=inline-start]:ps-1.5 [[data-slot=input-control],[data-slot=textarea-control]]:*:contents [[data-slot=input-control],[data-slot=textarea-control]]:*:before:hidden [input]:**:has-data-[align=block-end]:pt-1.5 [input]:**:has-data-[align=block-start]:pb-1.5 [input]:**:has-data-[align=inline-end]:pe-2 [input]:**:has-data-[align=inline-start]:ps-2 [input]:**:has-[[data-align=block-start],[data-align=block-end]]:h-auto [textarea_button]:**:rounded-[calc(var(--radius-md)-1px)] [textarea]:**:min-h-20.5 [textarea]:**:resize-none [textarea]:**:py-[calc(--spacing(3)-1px)] max-sm:[textarea]:**:min-h-23.5",
        className,
      )}
      data-slot="input-group"
      role="group"
      {...props}
    />
  );
}

export function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>): React.ReactElement {
  return (
    <div
      className={cn(inputGroupAddonVariants({ align }), className)}
      data-align={align}
      data-slot="input-group-addon"
      onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        const isInteractive = target.closest(
          "button, a, input, select, textarea, [role='button'], [role='combobox'], [role='listbox'], [data-slot='select-trigger']",
        );
        if (isInteractive) return;
        e.preventDefault();
        const parent = e.currentTarget.parentElement;
        const input = parent?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          "input, textarea",
        );
        if (input && !parent?.querySelector("input:focus, textarea:focus")) {
          input.focus();
        }
      }}
      {...props}
    />
  );
}

export function InputGroupText({
  className,
  ...props
}: React.ComponentProps<"span">): React.ReactElement {
  return (
    <span
      className={cn(
        "text-muted-foreground line-clamp-1 flex items-center gap-2 leading-none whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg:not([class*='size-'])]:in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:size-4.5 sm:[&_svg:not([class*='size-'])]:in-[[data-slot=input-group]:has([data-slot=input-control],[data-slot=textarea-control])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export function InputGroupInput({ className, ...props }: InputProps): React.ReactElement {
  return <Input className={className} unstyled {...props} />;
}

export function InputGroupTextarea({ className, ...props }: TextareaProps): React.ReactElement {
  return <Textarea className={className} unstyled {...props} />;
}
