"use client";

import { useFormState } from "react-dom";

import { SubmitButton } from "@/components/ui/submit-button";
import { resetClanEmblem, uploadClanEmblem } from "@/lib/actions/clans";
import type { ClanActionResult } from "@/lib/clans/errors";

interface EmblemFormProps {
  clanId: string;
  slug: string;
  currentEmblemUrl: string | null;
  currentPath: string | null;
}

/**
 * Clan emblem management: replace the current emblem or remove it. Uploads go
 * through the server action (re-encode, service-role upload, CAS pointer), and
 * the hidden expected-path field makes the compare-and-swap race-safe.
 */
export function EmblemForm({ clanId, slug, currentEmblemUrl, currentPath }: EmblemFormProps) {
  const [uploadState, uploadAction] = useFormState<ClanActionResult | null, FormData>(
    uploadClanEmblem,
    null,
  );
  const [resetState, resetAction] = useFormState<ClanActionResult | null, FormData>(
    resetClanEmblem,
    null,
  );

  const error = uploadState && !uploadState.ok ? uploadState : null;
  const resetError = resetState && !resetState.ok ? resetState : null;

  return (
    <div className="mt-3 flex flex-col gap-5">
      <div className="flex items-center gap-4">
        {currentEmblemUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentEmblemUrl}
            alt="Current clan emblem"
            className="border-border bg-bg-raised h-16 w-16 shrink-0 rounded-md border object-cover"
          />
        ) : (
          <span className="text-fg-subtle text-sm">No emblem yet.</span>
        )}
        <form action={uploadAction} className="flex flex-col gap-3">
          <input type="hidden" name="clanId" value={clanId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="expectedEmblemPath" value={currentPath ?? ""} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="clan-emblem" className="text-fg text-sm font-medium">
              Emblem image
            </label>
            <input
              id="clan-emblem"
              name="emblem"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              className="text-fg-muted file:border-border file:bg-surface file:text-fg block w-full max-w-sm text-sm file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-md file:border file:px-3 file:text-sm"
            />
          </div>
          {error?.fieldErrors?.emblem ? (
            <p role="alert" className="text-error text-xs">
              {error.fieldErrors.emblem}
            </p>
          ) : null}
          {error && !error.ok && !error.fieldErrors ? (
            <p role="alert" className="text-error text-xs">
              {error.message}
            </p>
          ) : null}
          <div>
            <SubmitButton pendingLabel="Uploading…">Upload emblem</SubmitButton>
          </div>
        </form>
      </div>

      {currentPath ? (
        <form action={resetAction} className="flex flex-col gap-2">
          <input type="hidden" name="clanId" value={clanId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="expectedEmblemPath" value={currentPath} />
          {resetError ? (
            <p role="alert" className="text-error text-xs">
              {resetError.message}
            </p>
          ) : null}
          <div>
            <SubmitButton pendingLabel="Removing…">Remove emblem</SubmitButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
