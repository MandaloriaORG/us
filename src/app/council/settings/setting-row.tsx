"use client";

import { useState, type FormEvent } from "react";
import { CheckIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { Input } from "@/components/origin/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { updateSiteSetting, type SettingActionResult } from "@/lib/actions/settings";
import type { SettingValueType } from "./settings-dto";
import type { Json } from "@/lib/database.types";
import { cn } from "@/lib/cn";
import { Textarea } from "@/components/ui/textarea";

export interface SettingRowProps {
  description: string | null;
  label: string;
  maxValue: number | null;
  minValue: number | null;
  settingKey: string;
  value: Json;
  valueType: SettingValueType;
}

function displayText(valueType: SettingValueType, value: Json) {
  return valueType === "json" || valueType === "array"
    ? JSON.stringify(value, null, 2)
    : String(value);
}

function parseJson(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * One setting row. Owns its draft locally so JSON values round-trip as objects
 * rather than form strings, and sends the value it was rendered with as the
 * compare-and-swap expected value — so a stale screen cannot silently
 * overwrite another administrator's change. Saving stays local to the row.
 */
export function SettingRow({
  description,
  label,
  maxValue,
  minValue,
  settingKey,
  value,
  valueType,
}: SettingRowProps) {
  const [draft, setDraft] = useState(() => displayText(valueType, value));
  const [checked, setChecked] = useState(value === true);
  const [committed, setCommitted] = useState<Json>(value);
  const [localError, setLocalError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SettingActionResult | null>(null);

  const controlId = `setting-${settingKey}`;

  async function save() {
    setLocalError(null);

    let next: Json;
    switch (valueType) {
      case "string":
        next = draft.trim();
        break;
      case "number": {
        const parsed = Number(draft);
        if (draft.trim() === "" || !Number.isFinite(parsed)) {
          setLocalError("Enter a number.");
          return;
        }
        next = parsed;
        break;
      }
      case "boolean":
        next = checked;
        break;
      case "json": {
        const parsed = parseJson(draft);
        if (parsed === undefined) {
          setLocalError("Enter valid JSON.");
          return;
        }
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          setLocalError("Enter a JSON object.");
          return;
        }
        next = parsed as Json;
        break;
      }
      case "array": {
        const parsed = parseJson(draft);
        if (parsed === undefined) {
          setLocalError("Enter valid JSON.");
          return;
        }
        if (!Array.isArray(parsed)) {
          setLocalError("Enter a JSON array.");
          return;
        }
        next = parsed;
        break;
      }
    }

    setPending(true);
    const action = await updateSiteSetting({
      key: settingKey,
      valueType,
      value: next,
      expectedValue: committed,
    });
    setResult(action);
    setPending(false);

    if (action.ok) {
      setCommitted(next);
    }
  }

  const control =
    valueType === "boolean" ? (
      <Checkbox
        aria-label={label}
        checked={checked}
        id={controlId}
        onCheckedChange={(next) => setChecked(next === true)}
      />
    ) : valueType === "json" || valueType === "array" ? (
      <Textarea
        aria-label={label}
        aria-invalid={localError ? true : undefined}
        aria-describedby={localError ? `${controlId}-error` : undefined}
        className={cn("min-h-24 resize-y", "sm:w-96")}
        id={controlId}
        onChange={(event) => setDraft(event.currentTarget.value)}
        rows={5}
        spellCheck={false}
        value={draft}
      />
    ) : (
      <Input
        aria-invalid={localError ? true : undefined}
        aria-label={label}
        className="w-full sm:w-72"
        id={controlId}
        inputMode={valueType === "number" ? "decimal" : undefined}
        max={maxValue ?? undefined}
        min={minValue ?? undefined}
        nativeInput
        onChange={(event) => setDraft(event.currentTarget.value)}
        type={valueType === "number" ? "number" : "text"}
        value={draft}
      />
    );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save();
  }

  return (
    <div className="border-border flex flex-col gap-3 border-b py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1">
        <p className="text-fg text-sm font-medium">{label}</p>
        {description ? <p className="text-fg-muted mt-1 text-xs">{description}</p> : null}
      </div>

      <form className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-72" onSubmit={handleSubmit}>
        {valueType === "boolean" ? (
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            {control}
            <Button disabled={pending} loading={pending} size="sm" type="submit">
              Save
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {control}
            <div className="flex justify-end">
              <Button disabled={pending} loading={pending} size="sm" type="submit">
                Save
              </Button>
            </div>
          </div>
        )}

        {localError ? (
          <p id={`${controlId}-error`} role="alert" className="text-error text-xs">
            {localError}
          </p>
        ) : null}

        {result && !result.ok ? (
          <p role="alert" className="text-error flex items-center gap-1.5 text-xs">
            <WarningCircleIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
            {result.message}
          </p>
        ) : null}

        {result?.ok ? (
          <p role="status" className="text-success flex items-center gap-1.5 text-xs">
            <CheckIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
            Saved.
          </p>
        ) : null}
      </form>
    </div>
  );
}
