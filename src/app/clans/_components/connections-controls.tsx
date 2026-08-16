"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cancelFriendRequest, respondFriendRequest, unblockUser } from "@/lib/actions/clans";
import type { ClanActionResult } from "@/lib/clans/errors";

interface RequestRow {
  friendshipId: string;
  peerId: string;
  peerName: string;
  direction: "incoming" | "outgoing";
}

interface BlockRow {
  blockedId: string;
  displayName: string;
}

interface ConnectionsControlsProps {
  requests: RequestRow[];
  blocks: BlockRow[];
}

/**
 * Action controls for the connections center: answer or cancel pending friend
 * requests and remove blocks. Never optimistic — waits for the action, shows
 * errors locally, and refreshes on success.
 */
export function ConnectionsControls({ requests, blocks }: ConnectionsControlsProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(
    action: (input: Record<string, unknown>) => Promise<ClanActionResult>,
    input: Record<string, unknown>,
    label: string,
  ) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action(input);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message ?? label);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-success flex items-center gap-1.5 text-sm">
          <CheckCircleIcon aria-hidden="true" className="h-4 w-4" />
          {message}
        </p>
      ) : null}

      {requests.length > 0 ? (
        <div className="border-border divide-border divide-y rounded-md border">
          {requests.map((request) => (
            <div
              key={request.friendshipId}
              className="flex min-h-12 items-center gap-3 px-4 py-2.5"
            >
              <Link
                href={`/members/${request.peerId}`}
                className="text-fg truncate text-sm hover:underline"
              >
                {request.peerName}
              </Link>
              <span className="text-fg-subtle ml-auto text-xs">
                {request.direction === "incoming" ? "requested to be friends" : "request sent"}
              </span>
              {request.direction === "incoming" ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      run(
                        respondFriendRequest,
                        {
                          friendshipId: request.friendshipId,
                          peerId: request.peerId,
                          accept: true,
                        },
                        "Request accepted.",
                      )
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={isPending}
                    onClick={() =>
                      run(
                        respondFriendRequest,
                        {
                          friendshipId: request.friendshipId,
                          peerId: request.peerId,
                          accept: false,
                        },
                        "Request rejected.",
                      )
                    }
                  >
                    Reject
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() =>
                    run(
                      cancelFriendRequest,
                      { friendshipId: request.friendshipId, peerId: request.peerId },
                      "Request cancelled.",
                    )
                  }
                >
                  Cancel
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-fg-subtle text-sm">No pending friend requests.</p>
      )}

      {blocks.length > 0 ? (
        <div className="border-border divide-border divide-y rounded-md border">
          {blocks.map((block) => (
            <div key={block.blockedId} className="flex min-h-12 items-center gap-3 px-4 py-2.5">
              <Link
                href={`/members/${block.blockedId}`}
                className="text-fg truncate text-sm hover:underline"
              >
                {block.displayName}
              </Link>
              <span className="text-fg-subtle ml-auto text-xs">Blocked</span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={() =>
                  run(unblockUser, { blockedId: block.blockedId }, "Member unblocked.")
                }
              >
                Unblock
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
