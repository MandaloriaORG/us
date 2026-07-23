"use client";

import { useFormState } from "react-dom";
import {
  UserIcon,
  FileTextIcon,
  GlobeIcon,
  WarningCircleIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react/dist/ssr";

import { NativeSelect } from "@/components/origin/native-select";
import { TextInput } from "@/components/origin/text-input";
import { Avatar } from "@/components/ui/avatar";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  resetAvatar,
  updateProfile,
  uploadAvatar,
  type ProfileResult,
} from "@/lib/actions/profile";
import { cn } from "@/lib/cn";

type ProfileVisibility = "public" | "members" | "private";

interface ProfileEditorProps {
  displayName: string;
  bio: string;
  website: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  profileVisibility: ProfileVisibility;
}

const initialState: ProfileResult = {};

function Feedback({ state }: { state: ProfileResult }) {
  return (
    <>
      {state.success ? (
        <div
          role="status"
          className="border-success/30 bg-success/10 text-success flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <CheckCircleIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
          {state.success}
        </div>
      ) : null}
      {state.warning ? (
        <div
          role="status"
          className="border-warning/30 bg-warning/10 text-warning flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <WarningCircleIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
          {state.warning}
        </div>
      ) : null}
      {state.error ? (
        <div
          role="alert"
          className="border-error/30 bg-error/10 text-error flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <WarningCircleIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      ) : null}
    </>
  );
}

export function ProfileEditor({
  displayName,
  bio,
  website,
  avatarPath,
  avatarUrl,
  profileVisibility,
}: ProfileEditorProps) {
  const [state, formAction] = useFormState(updateProfile, initialState);
  const [avatarState, avatarAction] = useFormState(uploadAvatar, initialState);
  const [resetState, resetAction] = useFormState(resetAvatar, initialState);
  const bioErrorId = state.fieldErrors?.bio ? "bio-error" : undefined;
  const avatarDescriptionId = "avatar-description";
  const avatarErrorId = avatarState.fieldErrors?.avatar ? "avatar-error" : undefined;

  return (
    <div className="mt-8 space-y-10">
      <section aria-labelledby="avatar-heading" className="space-y-4">
        <div>
          <h2 id="avatar-heading" className="text-fg text-lg font-semibold">
            Avatar
          </h2>
          <p className="text-fg-muted mt-1 text-sm">Upload a static JPEG, PNG, or WebP image.</p>
        </div>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar
            name={displayName}
            src={avatarUrl}
            alt="Current profile avatar"
            className="h-20 w-20"
          />
          <div className="min-w-0 flex-1 space-y-4">
            <Feedback state={avatarState} />
            <Feedback state={resetState} />

            <form action={avatarAction} aria-label="Upload avatar" className="space-y-3">
              <input type="hidden" name="expectedAvatarPath" value={avatarPath ?? ""} />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="avatar" className="text-fg text-sm font-medium">
                  Avatar image
                </label>
                <input
                  id="avatar"
                  name="avatar"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required
                  aria-describedby={[avatarDescriptionId, avatarErrorId].filter(Boolean).join(" ")}
                  aria-invalid={Boolean(avatarErrorId)}
                  className="border-border bg-bg text-fg file:border-border file:bg-bg-raised file:text-fg hover:border-border-raised focus-visible:ring-border-focus min-h-11 w-full rounded-md border text-sm file:mr-3 file:min-h-11 file:border-0 file:border-r file:px-3 file:text-sm file:font-medium focus-visible:ring-2 focus-visible:outline-hidden"
                />
                <p id={avatarDescriptionId} className="text-fg-muted text-xs">
                  Maximum 5 MiB and 40 megapixels. Output is resized to 512 pixels.
                </p>
                {avatarState.fieldErrors?.avatar ? (
                  <p id={avatarErrorId} className="text-error text-xs">
                    {avatarState.fieldErrors.avatar}
                  </p>
                ) : null}
              </div>
              <SubmitButton pendingLabel="Uploading avatar…">Upload avatar</SubmitButton>
            </form>

            {avatarPath ? (
              <form action={resetAction} aria-label="Remove avatar">
                <input type="hidden" name="expectedAvatarPath" value={avatarPath} />
                <SubmitButton pendingLabel="Removing avatar…">Remove avatar</SubmitButton>
              </form>
            ) : null}
          </div>
        </div>
      </section>

      <form action={formAction} aria-label="Edit profile" className="space-y-6">
        <Feedback state={state} />

        <TextInput
          id="displayName"
          name="displayName"
          type="text"
          label="Display name"
          icon={UserIcon}
          required
          minLength={2}
          maxLength={50}
          autoComplete="name"
          defaultValue={displayName}
          error={state.fieldErrors?.displayName}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="bio" className="text-fg mb-1.5 block text-sm font-medium">
            Bio
          </label>
          <div className="relative">
            <FileTextIcon
              aria-hidden="true"
              className="text-fg-muted absolute top-3 left-3 h-4 w-4"
            />
            <textarea
              id="bio"
              name="bio"
              rows={4}
              maxLength={500}
              defaultValue={bio}
              placeholder="Tell others about yourself..."
              aria-describedby={bioErrorId}
              aria-invalid={Boolean(state.fieldErrors?.bio)}
              className={cn(
                "bg-bg text-fg duration-fast placeholder:text-fg-subtle w-full resize-y rounded-md border px-4 py-3 pl-10 text-sm transition-colors",
                "focus-visible:ring-border-focus/40 focus-visible:ring-2 focus-visible:outline-hidden",
                state.fieldErrors?.bio ? "border-error" : "border-border",
              )}
            />
          </div>
          {state.fieldErrors?.bio ? (
            <p id={bioErrorId} className="text-error flex items-start gap-1.5 text-xs">
              <WarningCircleIcon aria-hidden="true" className="mt-px h-4 w-4 shrink-0" />
              <span>{state.fieldErrors.bio}</span>
            </p>
          ) : null}
        </div>

        <TextInput
          id="website"
          name="website"
          type="url"
          inputMode="url"
          label="Website"
          icon={GlobeIcon}
          maxLength={2048}
          autoComplete="url"
          defaultValue={website}
          placeholder="https://your-site.com"
          description="Only http and https addresses are accepted."
          error={state.fieldErrors?.website}
        />

        <NativeSelect
          id="profileVisibility"
          name="profileVisibility"
          label="Profile visibility"
          defaultValue={profileVisibility}
          description="Public is visible to everyone; Members requires an active account; Private is visible only to you."
          error={state.fieldErrors?.profileVisibility}
        >
          <option value="public">Public</option>
          <option value="members">Members</option>
          <option value="private">Private</option>
        </NativeSelect>

        <div className="flex items-center gap-4 pt-2">
          <SubmitButton pendingLabel="Saving changes…">Save changes</SubmitButton>
        </div>
      </form>
    </div>
  );
}
