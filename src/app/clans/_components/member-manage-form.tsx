"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { NativeSelect } from "@/components/origin/native-select";
import { Button } from "@/components/ui/button";
import { expelMember, setMemberRole, transferLeadership } from "@/lib/actions/clans";
import type { ClanActionResult } from "@/lib/clans/errors";

const TEXTAREA_CLASS =
  "border-border bg-bg text-fg duration-fast placeholder:text-fg-subtle focus-visible:border-border-focus focus-visible:ring-border-focus/40 aria-invalid:border-error aria-invalid:focus-visible:ring-error/30 min-h-20 w-full resize-y rounded-md border px-3 py-2 text-sm outline-hidden transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50";

interface ManageableMember {
  memberId: string;
  displayName: string;
  role: "leader" | "officer" | "member";
}

interface MemberManageFormProps {
  clanId: string;
  slug: string;
  /** Non-leader members the leader can act on. */
  members: ManageableMember[];
}

type Action = "officer" | "member" | "leader" | "expel";

/**
 * One form for every per-member management action: change role, transfer
 * leadership, or expel. The chosen member and action shape the Server Action
 * call, and the reason is always required because each RPC writes it to the
 * audit log. Expel additionally asks for explicit confirmation.
 */
export function MemberManageForm({ clanId, slug, members }: MemberManageFormProps) {
  const router = useRouter();
  const [memberId, setMemberId] = useState(members[0]?.memberId ?? "");
  const [action, setAction] = useState<Action>("officer");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (members.length === 0) {
    return <p className="text-fg-subtle text-sm">No other active members to manage.</p>;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memberId || !reason.trim()) return;
    if (action === "expel" && !confirmed) return;
    setError(null);
    setSuccess(null);

    const shared = { clanId, slug, memberId };

    startTransition(async () => {
      let result: ClanActionResult;
      if (action === "expel") result = await expelMember({ ...shared, reason });
      else if (action === "leader") result = await transferLeadership({ ...shared, reason });
      else result = await setMemberRole({ ...shared, role: action, reason });

      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(result.message ?? "Member updated.");
      setReason("");
      setConfirmed(false);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-5 sm:flex-row">
        <NativeSelect
          id="manage-member"
          label="Member"
          value={memberId}
          onChange={(event) => setMemberId(event.target.value)}
          disabled={isPending}
          fieldClassName="sm:max-w-xs"
        >
          {members.map((member) => (
            <option key={member.memberId} value={member.memberId}>
              {member.displayName}
            </option>
          ))}
        </NativeSelect>

        <NativeSelect
          id="manage-action"
          label="Action"
          value={action}
          onChange={(event) => setAction(event.target.value as Action)}
          disabled={isPending}
          fieldClassName="sm:max-w-xs"
        >
          <option value="officer">Set as officer</option>
          <option value="member">Set as member</option>
          <option value="leader">Make leader</option>
          <option value="expel">Expel</option>
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="manage-reason" className="text-fg text-sm font-medium">
          Reason <span className="text-error">*</span>
        </label>
        <textarea
          id="manage-reason"
          value={reason}
          required
          disabled={isPending}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          className={TEXTAREA_CLASS}
          placeholder="This is written to the audit log."
        />
      </div>

      {action === "expel" ? (
        <label className="text-fg-muted flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={isPending}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-1"
          />
          <span>
            This expels the member and records the reason. Expelled members can request to rejoin.
          </span>
        </label>
      ) : null}

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
          variant={action === "expel" ? "destructive" : "primary"}
          loading={isPending}
          disabled={isPending || !memberId || !reason.trim() || (action === "expel" && !confirmed)}
        >
          {action === "expel"
            ? "Expel member"
            : action === "leader"
              ? "Transfer leadership"
              : "Update role"}
        </Button>
      </div>
    </form>
  );
}
