"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { requestMembership, respondToInvite } from "@/lib/actions/clans";
import type { ClanActionResult } from "@/lib/clans/errors";

export interface OpenInvitation {
  membershipId: string;
}

interface ClanEntryActionsProps {
  clanId: string;
  slug: string;
  /** open clans admit directly; invite clans queue the request. */
  privacy: "open" | "invite" | "closed";
  invitation: OpenInvitation | null;
}

/**
 * Entry actions for a non-member on a clan page: request to join (open and
 * invite clans) or answer an open invitation (accept / decline). Not
 * optimistic — waits for the Server Action, shows errors locally, and
 * refreshes on success so the page re-renders the new membership state.
 */
export function ClanEntryActions({ clanId, slug, privacy, invitation }: ClanEntryActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (done) {
    return (
      <p role="status" className="text-success flex items-center gap-1.5 text-sm">
        <CheckCircleIcon aria-hidden="true" className="h-4 w-4" />
        {done}
      </p>
    );
  }

  function run(
    action: (input: Record<string, unknown>) => Promise<ClanActionResult>,
    input: Record<string, unknown>,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action(input);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setDone(result.message ?? "Done.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {invitation ? (
          <>
            <Button
              size="md"
              loading={isPending}
              disabled={isPending}
              onClick={() =>
                run(respondToInvite, { membershipId: invitation.membershipId, slug, accept: true })
              }
            >
              Accept invitation
            </Button>
            <Button
              size="md"
              variant="secondary"
              loading={isPending}
              disabled={isPending}
              onClick={() =>
                run(respondToInvite, { membershipId: invitation.membershipId, slug, accept: false })
              }
            >
              Decline
            </Button>
          </>
        ) : privacy === "closed" ? null : (
          <Button
            size="md"
            loading={isPending}
            disabled={isPending}
            onClick={() => run(requestMembership, { clanId, slug })}
          >
            {privacy === "open" ? "Join clan" : "Request to join"}
          </Button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
