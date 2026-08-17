"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { NativeSelect } from "@/components/origin/native-select";
import { Button } from "@/components/ui/button";
import { assignRank } from "@/lib/actions/clans";
import { Textarea } from "@/components/ui/textarea";


interface RankOption {
  slug: string;
  name: string;
}

interface AssignRankFormProps {
  userId: string;
  userName: string;
  ranks: RankOption[];
}

/** Assign a rank to an already-selected member. Requires `rank.manage`. */
export function AssignRankForm({ userId, userName, ranks }: AssignRankFormProps) {
  const router = useRouter();
  const [rankSlug, setRankSlug] = useState(ranks[0]?.slug ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rankSlug || !reason.trim()) return;
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await assignRank({ userId, rankSlug, reason });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(result.message ?? `Rank assigned to ${userName}.`);
      setReason("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex max-w-2xl flex-col gap-4">
      <p className="text-fg-muted text-sm">
        Assigning to <span className="text-fg font-medium">{userName}</span>. A member holds one
        rank; assigning replaces the current one.
      </p>

      <NativeSelect
        id="assign-rank-slug"
        label="Rank"
        value={rankSlug}
        onChange={(event) => setRankSlug(event.target.value)}
        disabled={isPending}
        fieldClassName="sm:max-w-xs"
      >
        {ranks.map((rank) => (
          <option key={rank.slug} value={rank.slug}>
            {rank.name}
          </option>
        ))}
      </NativeSelect>

      <div className="flex flex-col gap-2">
        <label htmlFor="assign-rank-reason" className="text-fg text-sm font-medium">
          Reason <span className="text-error">*</span>
        </label>
        <Textarea
          id="assign-rank-reason"
          value={reason}
          required
          disabled={isPending}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          className="border-border bg-bg text-fg focus-visible:border-border-focus focus-visible:ring-border-focus/40 min-h-20 w-full resize-y rounded-md border px-3 py-2 text-sm outline-hidden focus-visible:ring-2"
        />
      </div>

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
          disabled={isPending || !rankSlug || !reason.trim()}
        >
          Assign rank
        </Button>
      </div>
    </form>
  );
}
