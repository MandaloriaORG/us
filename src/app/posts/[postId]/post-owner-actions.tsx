"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PencilSimpleIcon, TrashIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { deletePost } from "@/lib/actions/content";

export interface PostOwnerActionsProps {
  postId: string;
  plazaSlug: string;
}

/**
 * Edit and delete for the post's own author, gated by `post.can_edit` at the
 * call site. Deletion is short work, so it stays an inline confirm rather than
 * a page or dialog; it is never optimistic — the redirect only happens after
 * the server confirms the delete.
 */
export function PostOwnerActions({ postId, plazaSlug }: PostOwnerActionsProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deletePost(postId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/plazas/${plazaSlug}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild size="sm" variant="secondary">
        <Link href={`/posts/${postId}/edit`}>
          <PencilSimpleIcon aria-hidden="true" className="h-4 w-4" />
          Edit
        </Link>
      </Button>

      {confirming ? (
        <>
          <span className="text-fg-muted text-xs">Delete this post? This cannot be undone.</span>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            loading={isPending}
            disabled={isPending}
            onClick={confirmDelete}
          >
            Confirm delete
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
        </>
      ) : (
        <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(true)}>
          <TrashIcon aria-hidden="true" className="h-4 w-4" />
          Delete
        </Button>
      )}
      {error ? (
        <p role="alert" className="text-error text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
