"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { TextInput } from "@/components/origin/text-input";
import { Button } from "@/components/ui/button";
import { createPost, updatePost } from "@/lib/actions/content";

export type PostFormProps =
  | { mode: "create"; plazaId: string }
  | { mode: "edit"; postId: string; initialTitle: string; initialBody: string };

const TEXTAREA_CLASS =
  "border-border bg-bg text-fg duration-fast placeholder:text-fg-subtle focus-visible:border-border-focus focus-visible:ring-border-focus/40 aria-invalid:border-error aria-invalid:focus-visible:ring-error/30 min-h-64 w-full resize-y rounded-md border px-3 py-2.5 text-sm outline-hidden transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Compose/edit form shared by the new-post page and the edit-post page: same
 * fields, different backing action, both substantial enough to be a page
 * rather than a dialog. Not acceptable to be optimistic — it waits for the
 * server result before navigating anywhere.
 */
export function PostForm(props: PostFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(props.mode === "edit" ? props.initialTitle : "");
  const [body, setBody] = useState(props.mode === "edit" ? props.initialBody : "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      const result =
        props.mode === "create"
          ? await createPost({ plazaId: props.plazaId, title, body })
          : await updatePost({ postId: props.postId, title, body });

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.message);
        return;
      }

      router.push(`/posts/${result.postId}`);
    });
  }

  function handleCancel() {
    if ((title || body) && !window.confirm("Discard this post?")) return;
    router.back();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex max-w-2xl flex-col gap-5">
      <TextInput
        id="post-title"
        label="Title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        required
        maxLength={300}
        disabled={isPending}
        error={fieldErrors.title}
      />

      <div className="flex flex-col gap-2">
        <label htmlFor="post-body" className="text-fg text-sm font-medium">
          Body
        </label>
        <textarea
          id="post-body"
          value={body}
          required
          disabled={isPending}
          aria-invalid={fieldErrors.body ? true : undefined}
          aria-describedby={fieldErrors.body ? "post-body-error" : "post-body-hint"}
          onChange={(event) => setBody(event.target.value)}
          className={TEXTAREA_CLASS}
          placeholder="Write in Markdown: headings, bold, italic, links, lists, quotes and code."
        />
        {fieldErrors.body ? (
          <p id="post-body-error" role="alert" className="text-error text-xs">
            {fieldErrors.body}
          </p>
        ) : (
          <p id="post-body-hint" className="text-fg-muted text-xs">
            Markdown supported. Images and raw HTML are not.
          </p>
        )}
      </div>

      {formError ? (
        <p role="alert" className="text-error text-sm">
          {formError}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" loading={isPending} disabled={isPending}>
          {props.mode === "create" ? "Publish post" : "Save changes"}
        </Button>
        <Button type="button" variant="secondary" disabled={isPending} onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
