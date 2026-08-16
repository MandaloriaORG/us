"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "react-dom";

import { NativeSelect } from "@/components/origin/native-select";
import { TextInput } from "@/components/origin/text-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { createClan } from "@/lib/actions/clans";
import type { ClanActionResult } from "@/lib/clans/errors";

const TEXTAREA_CLASS =
  "border-border bg-bg text-fg duration-fast placeholder:text-fg-subtle focus-visible:border-border-focus focus-visible:ring-border-focus/40 aria-invalid:border-error aria-invalid:focus-visible:ring-error/30 min-h-24 w-full resize-y rounded-md border px-3 py-2.5 text-sm outline-hidden transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50";

interface ClanCreateFormProps {
  leaderId: string;
  leaderName: string;
}

/** Admin-only create-clan form. The leader is chosen first on the page; the
 * form carries that id and the database creates the leader as the first
 * member in the same transaction. */
export function ClanCreateForm({ leaderId, leaderName }: ClanCreateFormProps) {
  const router = useRouter();

  async function submitAction(
    _prevState: ClanActionResult | null,
    formData: FormData,
  ): Promise<ClanActionResult> {
    return createClan({
      slug: String(formData.get("slug") ?? ""),
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      privacy: String(formData.get("privacy") ?? "open"),
      mission: String(formData.get("mission") ?? ""),
      leaderId,
    });
  }

  const [state, formAction] = useFormState<ClanActionResult | null, FormData>(submitAction, null);

  useEffect(() => {
    if (state?.ok && state.value) router.push(`/clans/${state.value}`);
  }, [router, state]);

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const formError = state && !state.ok ? state.message : null;

  return (
    <form action={formAction} className="mt-6 flex max-w-2xl flex-col gap-5">
      <p className="text-fg-muted text-sm">
        Leading clan: <span className="text-fg font-medium">{leaderName}</span>
      </p>

      <TextInput
        id="clan-slug"
        name="slug"
        label="Slug"
        required
        maxLength={48}
        error={fieldErrors.slug}
        description="Lowercase words separated by hyphens. Used in the clan's URL."
      />
      <TextInput
        id="clan-name"
        name="name"
        label="Name"
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
        defaultValue="open"
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

      <div>
        <SubmitButton pendingLabel="Creating…">Create clan</SubmitButton>
      </div>
    </form>
  );
}
