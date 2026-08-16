"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "react-dom";

import { TextInput } from "@/components/origin/text-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { upsertBadge } from "@/lib/actions/clans";
import type { ClanActionResult } from "@/lib/clans/errors";

interface BadgeFormProps {
  /** Badge slug to edit, or undefined to create. */
  editSlug?: string;
  initialName?: string;
  initialDescription?: string | null;
  initialIssuerPermission?: string | null;
  initialSortOrder?: number;
}

/** Create or edit a badge definition (upsert by slug). Requires `badge.manage`. */
export function BadgeForm({
  editSlug,
  initialName = "",
  initialDescription = null,
  initialIssuerPermission = null,
  initialSortOrder = 0,
}: BadgeFormProps) {
  const router = useRouter();

  async function submitAction(
    _prevState: ClanActionResult | null,
    formData: FormData,
  ): Promise<ClanActionResult> {
    const sortOrder = Number(formData.get("sortOrder") ?? 0);
    return upsertBadge({
      slug: String(formData.get("slug") ?? ""),
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      requiredIssuerPermission: String(formData.get("requiredIssuerPermission") ?? ""),
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    });
  }

  const [state, formAction] = useFormState<ClanActionResult | null, FormData>(submitAction, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [router, state]);

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const formError = state && !state.ok ? state.message : null;

  return (
    <form action={formAction} className="mt-3 flex max-w-2xl flex-col gap-4">
      <TextInput
        id="badge-slug"
        name="slug"
        label="Slug"
        defaultValue={editSlug ?? ""}
        required
        maxLength={40}
        error={fieldErrors.slug}
        description="Lowercase words separated by hyphens."
      />
      <TextInput
        id="badge-name"
        name="name"
        label="Name"
        defaultValue={initialName}
        required
        maxLength={60}
        error={fieldErrors.name}
      />
      <TextInput
        id="badge-description"
        name="description"
        label="Description"
        defaultValue={initialDescription ?? ""}
        maxLength={500}
        error={fieldErrors.description}
      />
      <div className="flex flex-col gap-5 sm:flex-row">
        <TextInput
          id="badge-issuer"
          name="requiredIssuerPermission"
          label="Required issuer permission"
          defaultValue={initialIssuerPermission ?? ""}
          maxLength={60}
          error={fieldErrors.requiredIssuerPermission}
          fieldClassName="sm:max-w-xs"
          description="Leave empty for any badge.award holder."
        />
        <TextInput
          id="badge-sort"
          name="sortOrder"
          type="number"
          label="Sort order"
          defaultValue={initialSortOrder}
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

      <div>
        <SubmitButton pendingLabel={editSlug ? "Saving…" : "Creating…"}>
          {editSlug ? "Save badge" : "Create badge"}
        </SubmitButton>
      </div>
    </form>
  );
}
