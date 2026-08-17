"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import type { ClanActionResult } from "@/lib/clans/errors";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";



export interface ReasonActionField {
  name: string;
  label: string;
  type?: "select" | "text";
  options?: { value: string; label: string }[];
  defaultValue?: string;
  required?: boolean;
}

interface ReasonActionFormProps {
  /** Server action receiving `{ ...hidden, ...fieldValues, reason }`. */
  action: (input: Record<string, unknown>) => Promise<ClanActionResult>;
  /** Constant hidden fields, e.g. `{ clanId, slug, memberId }`. */
  hidden: Record<string, string>;
  buttonLabel: string;
  description?: string;
  fields?: ReasonActionField[];
  reasonRequired?: boolean;
  reasonLabel?: string;
  variant?: "primary" | "secondary" | "destructive" | "ghost";
  successMessage?: string;
}

/**
 * Inline single-action form for the clan management surfaces: a compact
 * button that expands into a reason field (and optional select/text fields)
 * and submits to one Server Action. Never optimistic — it waits for the
 * action result, shows the error beside the form, and refreshes the route on
 * success so the server re-renders the new state.
 */
export function ReasonActionForm({
  action,
  hidden,
  buttonLabel,
  description,
  fields = [],
  reasonRequired = true,
  reasonLabel = "Reason",
  variant = "primary",
  successMessage,
}: ReasonActionFormProps) {
  const router = useRouter();
  const idBase = buttonLabel.toLowerCase().replace(/\s+/g, "-");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((field) => [field.name, field.defaultValue ?? ""])),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button type="button" size="sm" variant={variant} onClick={() => setOpen(true)}>
        {buttonLabel}
      </Button>
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reasonRequired && !reason.trim()) return;
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const input: Record<string, unknown> = { ...hidden, reason: reason.trim() || null };
      for (const field of fields) input[field.name] = values[field.name];
      const result = await action(input);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(result.message ?? successMessage ?? "Done.");
      setReason("");
      setValues(Object.fromEntries(fields.map((field) => [field.name, ""])));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      {description ? <p className="text-fg-muted text-xs">{description}</p> : null}

      {fields.map((field) =>
        field.type === "select" ? (
          <div key={field.name} className="flex flex-col gap-1.5">
            <label htmlFor={field.name} className="text-fg text-xs font-medium">
              {field.label}
            </label>
            <select
              id={field.name}
              name={field.name}
              required={field.required}
              disabled={isPending}
              value={values[field.name]}
              onChange={(event) => setValues((v) => ({ ...v, [field.name]: event.target.value }))}
              className="border-input bg-background text-fg focus-visible:ring-ring/24 duration-fast hover:border-border-raised min-h-10 w-full rounded-lg border px-3 text-sm shadow-[var(--shadow-xs),inset_0_1px_0_var(--color-black/4%)] transition-[border-color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-none dark:shadow-[var(--shadow-xs),inset_0_-1px_0_var(--color-white/6%)]"
            >
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div key={field.name} className="flex flex-col gap-1.5">
            <label htmlFor={field.name} className="text-fg text-xs font-medium">
              {field.label}
            </label>
            <Input
              id={field.name}
              name={field.name}
              type="text"
              required={field.required}
              disabled={isPending}
              value={values[field.name]}
              onChange={(event) => setValues((v) => ({ ...v, [field.name]: event.target.value }))}
              className="border-border bg-bg text-fg focus-visible:border-border-focus focus-visible:ring-border-focus/40 min-h-11 rounded-md border px-3 text-sm outline-hidden focus-visible:ring-2"
            />
          </div>
        ),
      )}

      {reasonRequired || reason ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idBase}-reason`} className="text-fg text-xs font-medium">
            {reasonLabel} {reasonRequired ? <span className="text-error">*</span> : null}
          </label>
          <Textarea
            id={`${idBase}-reason`}
            value={reason}
            disabled={isPending}
            required={reasonRequired}
            rows={2}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            className="border-border bg-bg text-fg focus-visible:border-border-focus focus-visible:ring-border-focus/40 min-h-16 w-full resize-y rounded-md border px-3 py-2 text-sm outline-hidden focus-visible:ring-2"
          />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-error text-xs">
          {error}
        </p>
      ) : null}

      {success && !open ? (
        <p role="status" className="text-success flex items-center gap-1.5 text-xs">
          <CheckCircleIcon aria-hidden="true" className="h-3.5 w-3.5" />
          {success}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          variant={variant}
          loading={isPending}
          disabled={isPending || (reasonRequired && !reason.trim())}
        >
          Confirm
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
