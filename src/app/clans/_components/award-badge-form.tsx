"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { NativeSelect } from "@/components/origin/native-select";
import { TextInput } from "@/components/origin/text-input";
import { Button } from "@/components/ui/button";
import { awardBadge } from "@/lib/actions/clans";
import { Textarea } from "@/components/ui/textarea";


interface AwardBadgeFormProps {
  userId: string;
  userName: string;
}

/** Award a badge to an already-selected member. The badge is chosen by slug
 * because the read contract has no badge catalog yet (see the phase report);
 * the RPC resolves the slug and refuses unknown or retired badges. */
export function AwardBadgeForm({ userId, userName }: AwardBadgeFormProps) {
  const router = useRouter();
  const [badgeSlug, setBadgeSlug] = useState("");
  const [reason, setReason] = useState("");
  const [evidenceRef, setEvidenceRef] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!badgeSlug.trim() || !reason.trim()) return;
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await awardBadge({
        userId,
        badgeSlug,
        reason,
        evidenceRef,
        evidenceVisibility: visibility,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(result.message ?? `Badge awarded to ${userName}.`);
      setBadgeSlug("");
      setReason("");
      setEvidenceRef("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex max-w-2xl flex-col gap-4">
      <p className="text-fg-muted text-sm">
        Awarding to <span className="text-fg font-medium">{userName}</span>.
      </p>

      <TextInput
        id="award-badge-slug"
        label="Badge slug"
        value={badgeSlug}
        onChange={(event) => setBadgeSlug(event.target.value)}
        required
        maxLength={40}
        placeholder="e.g. historian-of-the-forge"
        description="Lowercase words separated by hyphens."
      />

      <div className="flex flex-col gap-2">
        <label htmlFor="award-badge-reason" className="text-fg text-sm font-medium">
          Reason <span className="text-error">*</span>
        </label>
        <Textarea
          id="award-badge-reason"
          value={reason}
          required
          disabled={isPending}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          className="border-border bg-bg text-fg focus-visible:border-border-focus focus-visible:ring-border-focus/40 min-h-20 w-full resize-y rounded-md border px-3 py-2 text-sm outline-hidden focus-visible:ring-2"
        />
      </div>

      <TextInput
        id="award-badge-evidence"
        label="Evidence reference"
        value={evidenceRef}
        onChange={(event) => setEvidenceRef(event.target.value)}
        maxLength={500}
        description="Optional link or reference that verifies the achievement."
      />

      <NativeSelect
        id="award-badge-visibility"
        label="Evidence visibility"
        value={visibility}
        onChange={(event) => setVisibility(event.target.value as "public" | "private")}
        fieldClassName="sm:max-w-xs"
      >
        <option value="public">Public</option>
        <option value="private">Private — shown only to you and the Council</option>
      </NativeSelect>

      {error ? (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      ) : null}

      {success ? (
        <p role="status" className="text-success flex items-center gap-1.5 text-sm">
          <CheckCircleIcon aria-hidden="true" className="h-4 w-4" />
          {success}
        </p>
      ) : null}

      <div>
        <Button
          type="submit"
          loading={isPending}
          disabled={isPending || !badgeSlug.trim() || !reason.trim()}
        >
          Award badge
        </Button>
      </div>
    </form>
  );
}
