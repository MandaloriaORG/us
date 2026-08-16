"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "react-dom";

import { NativeSelect } from "@/components/origin/native-select";
import { TextInput } from "@/components/origin/text-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateClan } from "@/lib/actions/clans";
import type { ClanActionResult } from "@/lib/clans/errors";

const TEXTAREA_CLASS =
  "border-border bg-bg text-fg duration-fast placeholder:text-fg-subtle focus-visible:border-border-focus focus-visible:ring-border-focus/40 aria-invalid:border-error aria-invalid:focus-visible:ring-error/30 min-h-24 w-full resize-y rounded-md border px-3 py-2.5 text-sm outline-hidden transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50";

interface ClanEditFormProps {
  clanId: string;
  slug: string;
  initialName: string;
  initialDescription: string | null;
  initialPrivacy: "open" | "invite" | "closed";
  initialMission: string | null;
}

/**
 * Edit a clan's public identity: name, description, privacy and mission.
 * Backed by `admin_update_clan`, so this surface is for `admin.manage_clans`
 * holders only — the database re-checks the permission on every save.
 */
export function ClanEditForm({
  clanId,
  slug,
  initialName,
  initialDescription,
  initialPrivacy,
  initialMission,
}: ClanEditFormProps) {
  const router = useRouter();

  async function submitAction(
    _prevState: ClanActionResult | null,
    formData: FormData,
  ): Promise<ClanActionResult> {
    return updateClan({
      clanId,
      slug,
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      privacy: String(formData.get("privacy") ?? "open"),
      mission: String(formData.get("mission") ?? ""),
    });
  }

  const [state, formAction] = useFormState<ClanActionResult | null, FormData>(submitAction, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [router, state]);

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const formError = state && !state.ok ? state.message : null;

  return (
    <form action={formAction} className="mt-3 flex max-w-2xl flex-col gap-5">
      <TextInput
        id="clan-name"
        name="name"
        label="Name"
        defaultValue={initialName}
        required
        maxLength={80}
        error={fieldErrors.name}
      />

      <div className="flex flex-col gap-2">
        <label htmlFor="clan-description" className="text-fg text-sm font-medium">
          Description
        </label>
        <textarea
          id="clan-description"
          name="description"
          rows={3}
          maxLength={1000}
          defaultValue={initialDescription ?? ""}
          aria-invalid={fieldErrors.description ? true : undefined}
          className={TEXTAREA_CLASS}
          placeholder="What this Casa stands for"
        />
        {fieldErrors.description ? (
          <p role="alert" className="text-error text-xs">
            {fieldErrors.description}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="clan-mission" className="text-fg text-sm font-medium">
          Mission
        </label>
        <textarea
          id="clan-mission"
          name="mission"
          rows={4}
          maxLength={2000}
          defaultValue={initialMission ?? ""}
          aria-invalid={fieldErrors.mission ? true : undefined}
          className={TEXTAREA_CLASS}
          placeholder="The knowledge this Casa takes responsibility for"
        />
        {fieldErrors.mission ? (
          <p role="alert" className="text-error text-xs">
            {fieldErrors.mission}
          </p>
        ) : null}
      </div>

      <NativeSelect
        id="clan-privacy"
        name="privacy"
        label="Who can join"
        defaultValue={initialPrivacy}
        error={fieldErrors.privacy}
        fieldClassName="sm:max-w-xs"
      >
        <option value="open">Open — anyone can join</option>
        <option value="invite">Invite — requests are reviewed</option>
        <option value="closed">Closed — leaders invite</option>
      </NativeSelect>

      {formError ? (
        <p role="alert" className="text-error text-sm">
          {formError}
        </p>
      ) : null}

      <div className="flex gap-3">
        <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
      </div>
    </form>
  );
}
