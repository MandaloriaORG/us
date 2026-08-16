"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "react-dom";

import { TextInput } from "@/components/origin/text-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { upsertRank } from "@/lib/actions/clans";
import type { ClanActionResult } from "@/lib/clans/errors";

interface RankFormProps {
  /** Rank slug to edit, or undefined to create. */
  editSlug?: string;
  initialName?: string;
  initialDescription?: string | null;
  initialColor?: string | null;
  initialSortOrder?: number;
}

/** Create or edit a global rank (upsert by slug). Requires `rank.manage`. */
export function RankForm({
  editSlug,
  initialName = "",
  initialDescription = null,
  initialColor = null,
  initialSortOrder = 0,
}: RankFormProps) {
  const router = useRouter();

  async function submitAction(
    _prevState: ClanActionResult | null,
    formData: FormData,
  ): Promise<ClanActionResult> {
    const sortOrder = Number(formData.get("sortOrder") ?? 0);
    return upsertRank({
      slug: String(formData.get("slug") ?? ""),
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      color: String(formData.get("color") ?? ""),
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
        id="rank-slug"
        name="slug"
        label="Slug"
        defaultValue={editSlug ?? ""}
        required
        maxLength={40}
        error={fieldErrors.slug}
        description="Lowercase words separated by hyphens."
      />
      <TextInput
        id="rank-name"
        name="name"
        label="Name"
        defaultValue={initialName}
        required
        maxLength={60}
        error={fieldErrors.name}
      />
      <TextInput
        id="rank-description"
        name="description"
        label="Description"
        defaultValue={initialDescription ?? ""}
        maxLength={500}
        error={fieldErrors.description}
      />
      <div className="flex flex-col gap-5 sm:flex-row">
        <TextInput
          id="rank-color"
          name="color"
          label="Color"
          defaultValue={initialColor ?? ""}
          maxLength={9}
          error={fieldErrors.color}
          fieldClassName="sm:max-w-40"
          placeholder="#aabbcc"
          description="Optional accent used next to the name."
        />
        <TextInput
          id="rank-sort"
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
          {editSlug ? "Save rank" : "Create rank"}
        </SubmitButton>
      </div>
    </form>
  );
}
