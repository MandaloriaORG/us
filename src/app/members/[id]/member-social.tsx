"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircleIcon, ProhibitIcon, UserPlusIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import {
  blockUser,
  cancelFriendRequest,
  respondFriendRequest,
  sendFriendRequest,
  unblockUser,
} from "@/lib/actions/clans";
import type { SocialState } from "@/lib/clans/types";
import type { ClanActionResult } from "@/lib/clans/errors";

interface MemberSocialProps {
  targetUserId: string;
  social: SocialState;
}

/**
 * Friend and block controls on a member profile. The relationship state is
 * computed server-side (loadSocialState); this component renders the matching
 * controls and calls the Server Actions, whose RPCs re-check blocks in both
 * directions. Never optimistic — errors show locally and the route refreshes
 * on success.
 */
export function MemberSocial({ targetUserId, social }: MemberSocialProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");

  function run(
    action: (input: Record<string, unknown>) => Promise<ClanActionResult>,
    input: Record<string, unknown>,
  ) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action(input);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message ?? "Done.");
      setBlockOpen(false);
      setBlockReason("");
      router.refresh();
    });
  }

  function block() {
    run(blockUser, { blockedId: targetUserId, reason: blockReason || null });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {social.relationship === "blocked_by_me" ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={isPending}
            disabled={isPending}
            onClick={() => run(unblockUser, { blockedId: targetUserId })}
          >
            Unblock
          </Button>
        ) : social.relationship === "incoming_request" ? (
          <>
            <Button
              type="button"
              size="sm"
              loading={isPending}
              disabled={isPending}
              onClick={() =>
                run(respondFriendRequest, {
                  friendshipId: social.friendshipId,
                  peerId: targetUserId,
                  accept: true,
                })
              }
            >
              Accept request
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={isPending}
              disabled={isPending}
              onClick={() =>
                run(respondFriendRequest, {
                  friendshipId: social.friendshipId,
                  peerId: targetUserId,
                  accept: false,
                })
              }
            >
              Reject
            </Button>
          </>
        ) : social.relationship === "outgoing_request" ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={isPending}
            disabled={isPending}
            onClick={() =>
              run(cancelFriendRequest, {
                friendshipId: social.friendshipId,
                peerId: targetUserId,
              })
            }
          >
            Cancel request
          </Button>
        ) : social.relationship === "friends" ? (
          <span className="text-success flex items-center gap-1.5 text-sm">
            <CheckCircleIcon aria-hidden="true" className="h-4 w-4" />
            Friends
          </span>
        ) : (
          <Button
            type="button"
            size="sm"
            loading={isPending}
            disabled={isPending}
            onClick={() => run(sendFriendRequest, { addresseeId: targetUserId })}
          >
            <UserPlusIcon aria-hidden="true" className="h-4 w-4" />
            Add friend
          </Button>
        )}

        {social.relationship !== "blocked_by_me" ? (
          blockOpen ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="block-reason" className="text-fg-muted text-xs">
                Reason <span className="text-fg-subtle">(optional, not shown to them)</span>
              </label>
              <textarea
                id="block-reason"
                value={blockReason}
                maxLength={500}
                disabled={isPending}
                onChange={(event) => setBlockReason(event.target.value)}
                rows={2}
                className="border-border bg-bg text-fg focus-visible:border-border-focus focus-visible:ring-border-focus/40 min-h-16 w-64 resize-y rounded-md border px-3 py-2 text-sm outline-hidden focus-visible:ring-2"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  loading={isPending}
                  disabled={isPending}
                  onClick={block}
                >
                  <ProhibitIcon aria-hidden="true" className="h-4 w-4" />
                  Confirm block
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => setBlockOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => setBlockOpen(true)}
            >
              <ProhibitIcon aria-hidden="true" className="h-4 w-4" />
              Block
            </Button>
          )
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-success text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
