"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "react-dom";

import { NativeSelect } from "@/components/origin/native-select";
import { TextInput } from "@/components/origin/text-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { createPlaza, updatePlaza, type PlazaActionResult } from "@/lib/actions/plazas";

export type PlazaFormProps =
  | { mode: "create" }
  | {
      mode: "edit";
      plazaId: string;
      initialSlug: string;
      initialName: string;
      initialDescription: string | null;
      initialRules: string | null;
      initialVisibility: "public" | "members" | "private";
      initialSortOrder: number;
    };

const TEXTAREA_CLASS =
  "border-border bg-bg text-fg duration-fast placeholder:text-fg-subtle focus-visible:border-border-focus focus-visible:ring-border-focus/40 aria-invalid:border-error aria-invalid:focus-visible:ring-error/30 min-h-24 w-full resize-y rounded-md border px-3 py-2.5 text-sm outline-hidden transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50";

function readSortOrder(formData: FormData) {
  const raw = formData.get("sortOrder");
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Shared create/edit form for a Plaza: same fields (slug, name, description,
 * visibility, sort order), different backing Server Action. Edit adds the
 * rules field and the Plaza's id, captured from props rather than a hidden
 * input since the server re-checks authority regardless. Not optimistic: it
 * waits for the Server Action result, matching every other Council mutation.
 */
export function PlazaForm(props: PlazaFormProps) {
  const router = useRouter();

  async function submitAction(
    _prevState: PlazaActionResult | null,
    formData: FormData,
  ): Promise<PlazaActionResult> {
    const shared = {
      slug: String(formData.get("slug") ?? ""),
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      visibility: String(formData.get("visibility") ?? "public"),
      sortOrder: readSortOrder(formData),
    };

    if (props.mode === "create") return createPlaza(shared);

    return updatePlaza({
      ...shared,
      plazaId: props.plazaId,
      rules: String(formData.get("rules") ?? ""),
    });
  }

  const [state, formAction] = useFormState<PlazaActionResult | null, FormData>(submitAction, null);

  useEffect(() => {
    if (props.mode === "create" && state?.ok) {
      router.push(`/council/plazas/${state.plazaId}`);
    }
  }, [props.mode, router, state]);

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const formError = state && !state.ok ? state.message : null;
  const formSuccess = props.mode === "edit" && state?.ok ? "Plaza updated." : null;

  return (
    <form action={formAction} className="mt-6 flex max-w-2xl flex-col gap-5">
      <TextInput
        id="plaza-slug"
        name="slug"
        label="Slug"
        defaultValue={props.mode === "edit" ? props.initialSlug : ""}
        required
        maxLength={48}
        error={fieldErrors.slug}
        description="Lowercase words separated by hyphens. Used in the Plaza's URL."
      />

      <TextInput
        id="plaza-name"
        name="name"
        label="Name"
        defaultValue={props.mode === "edit" ? props.initialName : ""}
        required
        maxLength={80}
        error={fieldErrors.name}
      />

      <div className="flex flex-col gap-2">
        <label htmlFor="plaza-description" className="text-fg text-sm font-medium">
          Description
        </label>
        <textarea
          id="plaza-description"
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={props.mode === "edit" ? (props.initialDescription ?? "") : ""}
          aria-invalid={fieldErrors.description ? true : undefined}
          aria-describedby={fieldErrors.description ? "plaza-description-error" : undefined}
          className={TEXTAREA_CLASS}
          placeholder="What this Plaza is for"
        />
        {fieldErrors.description ? (
          <p id="plaza-description-error" role="alert" className="text-error text-xs">
            {fieldErrors.description}
          </p>
        ) : null}
      </div>

      {props.mode === "edit" ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="plaza-rules" className="text-fg text-sm font-medium">
            Rules
          </label>
          <textarea
            id="plaza-rules"
            name="rules"
            rows={6}
            maxLength={4000}
            defaultValue={props.initialRules ?? ""}
            aria-invalid={fieldErrors.rules ? true : undefined}
            aria-describedby={fieldErrors.rules ? "plaza-rules-error" : undefined}
            className={TEXTAREA_CLASS}
            placeholder="Posting guidelines specific to this Plaza"
          />
          {fieldErrors.rules ? (
            <p id="plaza-rules-error" role="alert" className="text-error text-xs">
              {fieldErrors.rules}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-5 sm:flex-row">
        <NativeSelect
          id="plaza-visibility"
          name="visibility"
          label="Who can see this Plaza"
          defaultValue={props.mode === "edit" ? props.initialVisibility : "public"}
          error={fieldErrors.visibility}
          fieldClassName="sm:max-w-xs"
        >
          <option value="public">Public</option>
          <option value="members">Members</option>
          <option value="private">Private</option>
        </NativeSelect>

        <TextInput
          id="plaza-sort-order"
          name="sortOrder"
          type="number"
          label="Sort order"
          defaultValue={props.mode === "edit" ? props.initialSortOrder : 0}
          min={0}
          max={10_000}
          error={fieldErrors.sortOrder}
          fieldClassName="sm:max-w-32"
        />
      </div>

      {formError ? (
        <p role="alert" className="text-error text-sm">
          {formError}
        </p>
      ) : null}

      {formSuccess ? (
        <p role="status" className="text-success text-sm">
          {formSuccess}
        </p>
      ) : null}

      <div className="flex gap-3">
        <SubmitButton pendingLabel={props.mode === "create" ? "Creating…" : "Saving…"}>
          {props.mode === "create" ? "Create Plaza" : "Save changes"}
        </SubmitButton>
      </div>
    </form>
  );
}
