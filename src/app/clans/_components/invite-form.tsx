"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { TextInput } from "@/components/origin/text-input";
import { Button } from "@/components/ui/button";
import { inviteToClan } from "@/lib/actions/clans";

interface InviteFormProps {
  clanId: string;
  slug: string;
  memberId: string;
  memberName: string;
}

/** Invite one already-selected member into the clan, with an optional note. */
export function InviteForm({ clanId, slug, memberId, memberName }: InviteFormProps) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await inviteToClan({ clanId, slug, memberId, note });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(`Invitation sent to ${memberName}.`);
      setNote("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex max-w-xl flex-col gap-4">
      <p className="text-fg-muted text-sm">
        Inviting <span className="text-fg font-medium">{memberName}</span>. They will be asked to
        accept.
      </p>

      <TextInput
        id="invite-note"
        label="Note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={500}
        placeholder="Optional message for the invitation"
      />

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
        <Button type="submit" loading={isPending} disabled={isPending}>
          Send invitation
        </Button>
      </div>
    </form>
  );
}
