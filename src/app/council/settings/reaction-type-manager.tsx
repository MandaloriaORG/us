"use client";

import { useState } from "react";
import {
  CheckIcon,
  PencilSimpleIcon,
  PlusIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/origin/input";
import { TextInput } from "@/components/origin/text-input";
import { NativeSelect } from "@/components/origin/native-select";
import { Badge } from "@/components/origin/badge";
import {
  setReactionTypeActive,
  upsertReactionType,
  type ReactionTypeActionResult,
} from "@/lib/actions/reaction-types";

/** One row of `admin_list_reaction_types`, the Council-only full listing. */
export interface AdminReactionType {
  key: string;
  label: string;
  emoji: string;
  is_active: boolean;
  affects_reputation: boolean;
  sort_order: number;
  created_at: string;
}

export interface ReactionTypeManagerProps {
  types: AdminReactionType[];
}

interface Draft {
  key: string;
  label: string;
  emoji: string;
  affectsReputation: boolean;
  sortOrder: number;
}

const EMPTY_DRAFT: Draft = {
  key: "",
  label: "",
  emoji: "",
  affectsReputation: false,
  sortOrder: 0,
};

/**
 * Council surface for the reaction-type catalog. Lists every type (active or
 * not) from `admin_list_reaction_types`, creates/edits via
 * `admin_upsert_reaction_type` and toggles activation via the CAS
 * `admin_set_reaction_type_active`. Not optimistic: each change waits for the
 * Server Action and applies the server's answer, matching every other Council
 * mutation.
 */
export function ReactionTypeManager({ types }: ReactionTypeManagerProps) {
  const [rows, setRows] = useState<AdminReactionType[]>(types);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<ReactionTypeActionResult | null>(null);

  const fieldErrors = feedback && !feedback.ok ? (feedback.fieldErrors ?? {}) : {};
  const formError = feedback && !feedback.ok ? feedback.message : null;

  function applyResult(result: ReactionTypeActionResult, updated: AdminReactionType) {
    if (!result.ok) {
      setFeedback(result);
      return;
    }
    setFeedback({ ok: true, key: result.key });
    setRows((current) => {
      const exists = current.some((row) => row.key === updated.key);
      return exists
        ? current.map((row) => (row.key === updated.key ? updated : row))
        : [...current, updated].sort(
            (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label),
          );
    });
  }

  async function handleToggle(row: AdminReactionType) {
    setPending(true);
    setFeedback(null);
    const result = await setReactionTypeActive({
      key: row.key,
      expectedActive: row.is_active,
      isActive: !row.is_active,
      reason: !row.is_active ? "Reactivated from Council" : "Deactivated from Council",
    });
    setPending(false);
    applyResult(result, { ...row, is_active: !row.is_active });
  }

  async function handleSave() {
    if (!draft) return;
    setPending(true);
    setFeedback(null);
    const result = await upsertReactionType(draft);
    setPending(false);
    applyResult(result, {
      key: result.ok ? result.key : draft.key,
      label: draft.label,
      emoji: draft.emoji,
      is_active: true,
      affects_reputation: draft.affectsReputation,
      sort_order: draft.sortOrder,
      created_at: new Date().toISOString(),
    });
    if (result.ok) setDraft(null);
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-fg text-lg font-semibold">Reaction types</h2>
          <p className="text-fg-muted mt-1 text-sm">
            The catalog of emoji reactions members can use. Inactive types are hidden from the
            pickers but kept here so they can be re-enabled.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            setDraft(draft ? null : { ...EMPTY_DRAFT });
            setFeedback(null);
          }}
        >
          <PlusIcon aria-hidden="true" className="h-4 w-4" />
          {draft ? "Cancel" : "New type"}
        </Button>
      </div>

      {formError ? (
        <p role="alert" className="text-error mt-4 flex items-center gap-1.5 text-sm">
          <WarningCircleIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
          {formError}
        </p>
      ) : null}
      {feedback?.ok ? (
        <p role="status" className="text-success mt-4 flex items-center gap-1.5 text-sm">
          <CheckIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
          Saved.
        </p>
      ) : null}

      {draft ? (
        <form
          className="border-border bg-bg-raised mt-4 flex max-w-2xl flex-col gap-4 rounded-lg border p-4 sm:p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <div className="flex flex-col gap-4 sm:flex-row">
            <TextInput
              id="reaction-key"
              name="key"
              label="Key"
              value={draft.key}
              onChange={(event) => setDraft({ ...draft, key: event.currentTarget.value })}
              maxLength={32}
              error={fieldErrors.key}
              description="Lowercase words separated by hyphens. Fixed once created."
              className="focus-visible:ring-brand/30 has-focus-visible:border-brand/60"
            />
            <TextInput
              id="reaction-label"
              name="label"
              label="Label"
              value={draft.label}
              onChange={(event) => setDraft({ ...draft, label: event.currentTarget.value })}
              maxLength={40}
              error={fieldErrors.label}
              className="focus-visible:ring-brand/30 has-focus-visible:border-brand/60"
            />
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex flex-col gap-2">
              <label htmlFor="reaction-emoji" className="text-fg text-sm font-medium">
                Emoji
              </label>
              <Input
                id="reaction-emoji"
                value={draft.emoji}
                nativeInput
                maxLength={8}
                aria-invalid={fieldErrors.emoji ? true : undefined}
                aria-describedby={fieldErrors.emoji ? "reaction-emoji-error" : undefined}
                onChange={(event) => setDraft({ ...draft, emoji: event.currentTarget.value })}
                className="w-full sm:w-32"
              />
              {fieldErrors.emoji ? (
                <p id="reaction-emoji-error" role="alert" className="text-error text-xs">
                  {fieldErrors.emoji}
                </p>
              ) : null}
            </div>

            <TextInput
              id="reaction-sort"
              name="sortOrder"
              type="number"
              label="Sort order"
              value={draft.sortOrder}
              min={0}
              max={10_000}
              error={fieldErrors.sortOrder}
              fieldClassName="sm:max-w-32"
              onChange={(event) =>
                setDraft({ ...draft, sortOrder: Number(event.currentTarget.value) || 0 })
              }
            />

            <div className="flex items-end gap-2 pb-1">
              <Checkbox
                id="reaction-reputation"
                checked={draft.affectsReputation}
                onCheckedChange={(next) => setDraft({ ...draft, affectsReputation: next === true })}
              />
              <label htmlFor="reaction-reputation" className="text-fg text-sm">
                Affects reputation
              </label>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" size="sm" loading={pending} disabled={pending}>
              {rows.some((row) => row.key === draft.key) ? "Save changes" : "Create type"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setDraft(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-fg-muted mt-4 text-sm">No reaction types yet. Create the first one.</p>
      ) : (
        <ul className="border-border divide-border mt-4 divide-y border-t">
          {rows.map((row) => (
            <li key={row.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className="text-xl leading-none">
                  {row.emoji}
                </span>
                <div className="min-w-0">
                  <p className="text-fg flex items-center gap-2 text-sm font-medium">
                    {row.label}
                    {row.is_active ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </p>
                  <p className="text-fg-muted mt-0.5 text-xs">
                    {row.key}
                    {row.affects_reputation ? " · affects reputation" : ""} · order{" "}
                    <span className="tabular-nums">{row.sort_order}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    setDraft({
                      key: row.key,
                      label: row.label,
                      emoji: row.emoji,
                      affectsReputation: row.affects_reputation,
                      sortOrder: row.sort_order,
                    });
                    setFeedback(null);
                  }}
                >
                  <PencilSimpleIcon aria-hidden="true" className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={row.is_active ? "secondary" : "ghost"}
                  disabled={pending}
                  loading={pending}
                  onClick={() => void handleToggle(row)}
                >
                  {row.is_active ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
