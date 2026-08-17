"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowsClockwiseIcon,
  CodeIcon,
  EyeIcon,
  LinkSimpleIcon,
  ListBulletsIcon,
  LockSimpleIcon,
  PencilLineIcon,
  QuotesIcon,
  TextBolderIcon,
  TextHOneIcon,
  TextItalicIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

import { Badge } from "@/components/origin/badge";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/origin/text-input";
import { Textarea } from "@/components/origin/textarea";
import {
  publishArticle,
  restoreArticleVersion,
  setArticleStatus,
  updateArticle,
} from "@/lib/actions/codex";
import { ARTICLE_STATUS_LABELS } from "@/lib/codex/states";
import { renderMarkdown } from "@/lib/content/markdown";
import { formatRelativeTime } from "@/lib/time";
import type { ArticleDetail, CodexVersion } from "@/lib/codex/queries";

interface EditorFormProps {
  article: ArticleDetail;
  canPublish: boolean;
  versions: CodexVersion[];
}

export function EditorForm({ article, canPublish, versions }: EditorFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(article.title);
  const [body, setBody] = useState(article.body);
  const [excerpt, setExcerpt] = useState(article.excerpt ?? "");
  const [changeSummary, setChangeSummary] = useState("");
  const [preview, setPreview] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const isPublic = article.status === "published" || article.status === "locked";

  function run(action: () => Promise<unknown>, refresh = true) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result && typeof result === "object" && "ok" in result && !result.ok) {
        const failure = result as { message?: unknown; fieldErrors?: Record<string, string> };
        setError(typeof failure.message === "string" ? failure.message : "Something went wrong.");
        setFieldErrors(failure.fieldErrors);
        return;
      }
      if (refresh) router.refresh();
    });
  }

  function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors(undefined);
    run(() =>
      updateArticle({
        articleId: article.id,
        slug: article.slug,
        title,
        body,
        excerpt,
        changeSummary,
      }),
    );
  }

  const statusActions: {
    label: string;
    to: "published" | "unpublished" | "archived" | "locked";
    requiresReason: boolean;
  }[] = [];
  if (article.status === "draft" || article.status === "unpublished") {
    statusActions.push({ label: "Publish", to: "published", requiresReason: false });
    statusActions.push({ label: "Archive", to: "archived", requiresReason: true });
  } else if (article.status === "archived") {
    statusActions.push({ label: "Publish", to: "published", requiresReason: false });
  } else if (article.status === "published") {
    statusActions.push({ label: "Unpublish", to: "unpublished", requiresReason: true });
    statusActions.push({ label: "Archive", to: "archived", requiresReason: true });
    statusActions.push({ label: "Lock", to: "locked", requiresReason: true });
  } else if (article.status === "locked") {
    statusActions.push({ label: "Unlock", to: "published", requiresReason: true });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-fg text-lg font-semibold">{article.title}</h2>
        <Badge variant="outline">{ARTICLE_STATUS_LABELS[article.status]}</Badge>
        {isPublic ? (
          <Link
            href={`/codex/${article.slug}`}
            className="text-brand focus-visible:ring-border-focus inline-flex min-h-6 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
          >
            View published
          </Link>
        ) : null}
      </div>
      <p className="text-fg-subtle -mt-3 text-sm">
        {article.category_name} · v{article.version}
      </p>

      {article.status === "locked" ? (
        <div
          role="note"
          className="border-border text-fg-subtle flex items-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm"
        >
          <LockSimpleIcon aria-hidden="true" className="h-4 w-4" />
          This article is locked and read-only. Unlock it to edit.
        </div>
      ) : null}

      <form className="flex flex-col gap-4" onSubmit={onSave}>
        <TextInput
          disabled={article.status === "locked"}
          error={fieldErrors?.title}
          id="edit-title"
          label="Title"
          onChange={(event) => setTitle(event.target.value)}
          value={title}
        />
        <TextInput
          disabled={article.status === "locked"}
          error={fieldErrors?.excerpt}
          id="edit-excerpt"
          label="Excerpt"
          onChange={(event) => setExcerpt(event.target.value)}
          value={excerpt}
        />

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-fg text-sm font-medium" htmlFor="edit-body">
              Body (Markdown)
            </label>
            <Button
              disabled={article.status === "locked"}
              onClick={() => setPreview((value) => !value)}
              size="sm"
              type="button"
              variant="ghost"
            >
              {preview ? (
                <>
                  <PencilLineIcon aria-hidden="true" className="h-4 w-4" />
                  Edit
                </>
              ) : (
                <>
                  <EyeIcon aria-hidden="true" className="h-4 w-4" />
                  Preview
                </>
              )}
            </Button>
          </div>
          {!preview ? (
            <div
              className="border-border bg-bg-raised/60 flex flex-wrap items-center gap-0.5 rounded-t-md border border-b-0 p-1"
              role="toolbar"
              aria-label="Markdown formatting"
            >
              <ToolbarItem
                disabled={article.status === "locked"}
                label="Bold"
                onInsert={() => applyMarkdown(body, setBody, "**", "**")}
                Icon={TextBolderIcon}
              />
              <ToolbarItem
                disabled={article.status === "locked"}
                label="Italic"
                onInsert={() => applyMarkdown(body, setBody, "_", "_")}
                Icon={TextItalicIcon}
              />
              <span aria-hidden="true" className="border-border bg-border mx-1 h-4 w-px" />
              <ToolbarItem
                disabled={article.status === "locked"}
                label="Heading"
                onInsert={() => applyMarkdown(body, setBody, "## ", "\n")}
                Icon={TextHOneIcon}
              />
              <ToolbarItem
                disabled={article.status === "locked"}
                label="Link"
                onInsert={() => applyMarkdown(body, setBody, "[", "](https://)")}
                Icon={LinkSimpleIcon}
              />
              <ToolbarItem
                disabled={article.status === "locked"}
                label="Bulleted list"
                onInsert={() => applyMarkdown(body, setBody, "\n- ", "\n")}
                Icon={ListBulletsIcon}
              />
              <ToolbarItem
                disabled={article.status === "locked"}
                label="Quote"
                onInsert={() => applyMarkdown(body, setBody, "\n> ", "\n")}
                Icon={QuotesIcon}
              />
              <ToolbarItem
                disabled={article.status === "locked"}
                label="Code"
                onInsert={() => applyMarkdown(body, setBody, "`", "`")}
                Icon={CodeIcon}
              />
            </div>
          ) : null}
          {preview ? (
            <div
              className="text-fg border-border [&_a]:text-brand min-h-40 rounded-md border p-4 text-sm leading-relaxed [&_a]:underline-offset-4 [&_a:hover]:underline [&_p]:mt-3 [&_p:first-child]:mt-0"
              data-testid="editor-preview"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(body, { maxLength: 100_000 }) }}
            />
          ) : (
            <Textarea
              disabled={article.status === "locked"}
              id="edit-body"
              onChange={(event) => setBody(event.target.value)}
              rows={18}
              value={body}
            />
          )}
          {fieldErrors?.body ? (
            <p className="text-error text-xs" role="alert">
              {fieldErrors.body}
            </p>
          ) : null}
        </div>

        <TextInput
          description="Saved with the change; readers of the version history see it."
          error={fieldErrors?.changeSummary}
          id="edit-summary"
          label="Change summary"
          onChange={(event) => setChangeSummary(event.target.value)}
          value={changeSummary}
        />

        {error && !fieldErrors ? (
          <p className="text-error text-xs" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button disabled={pending || article.status === "locked"} loading={pending} type="submit">
            Save changes
          </Button>
          {canPublish
            ? statusActions.map((action) => (
                <StatusTransitionButton
                  article={article}
                  key={action.to}
                  onRun={(reason) =>
                    run(() =>
                      action.to === "published"
                        ? publishArticle({
                            articleId: article.id,
                            slug: article.slug,
                            expectedStatus: article.status,
                            changeSummary: changeSummary || "Publish",
                          })
                        : setArticleStatus({
                            articleId: article.id,
                            slug: article.slug,
                            expectedStatus: article.status,
                            status: action.to,
                            reason,
                          }),
                    )
                  }
                  requiresReason={action.requiresReason}
                  label={action.label}
                />
              ))
            : null}
        </div>
      </form>

      {canPublish ? (
        <VersionHistory
          article={article}
          onRestore={(version, reason) =>
            run(() =>
              restoreArticleVersion({ articleId: article.id, slug: article.slug, version, reason }),
            )
          }
          versions={versions}
        />
      ) : null}
    </div>
  );
}

function StatusTransitionButton({
  article,
  label,
  onRun,
  requiresReason,
}: {
  article: ArticleDetail;
  label: string;
  onRun: (reason: string) => void;
  requiresReason: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (!open) {
    return (
      <Button
        disabled={article.status === "locked"}
        onClick={() => setOpen(true)}
        size="md"
        type="button"
        variant="secondary"
      >
        {label}
      </Button>
    );
  }

  return (
    <form
      className="border-border bg-surface flex items-end gap-2 rounded-md border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        onRun(reason);
        setOpen(false);
      }}
    >
      {requiresReason ? (
        <TextInput
          id={`status-reason-${label.toLowerCase()}`}
          label="Reason"
          onChange={(event) => setReason(event.target.value)}
          value={reason}
        />
      ) : null}
      <Button disabled={requiresReason && reason.trim().length < 3} size="md" type="submit">
        {label}
      </Button>
      <Button onClick={() => setOpen(false)} size="md" type="button" variant="ghost">
        Cancel
      </Button>
    </form>
  );
}

function VersionHistory({
  article,
  onRestore,
  versions,
}: {
  article: ArticleDetail;
  onRestore: (version: number, reason: string) => void;
  versions: CodexVersion[];
}) {
  const [openVersion, setOpenVersion] = useState<number | null>(null);
  const [reason, setReason] = useState("");

  if (versions.length === 0) {
    return (
      <section aria-labelledby="version-history-heading" className="border-border border-t pt-5">
        <h3 className="text-fg text-base font-semibold" id="version-history-heading">
          Version history
        </h3>
        <p className="text-fg-muted mt-1 text-sm">
          No prior version yet. Publishing or editing a published article snapshots the previous
          wording here.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="version-history-heading" className="border-border border-t pt-5">
      <h3 className="text-fg text-base font-semibold" id="version-history-heading">
        Version history
      </h3>
      <ul className="mt-3 flex flex-col gap-2">
        {versions.map((version) => (
          <li className="border-border rounded-md border p-3" key={version.version_id}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-fg text-sm font-medium tabular-nums">v{version.version}</span>
              <span className="text-fg-muted text-sm">{version.title}</span>
              {version.change_summary ? (
                <span className="text-fg-muted text-sm">— {version.change_summary}</span>
              ) : null}
              <span className="text-fg-subtle ml-auto text-xs">
                {version.editor_display_name ?? "Former member"} ·{" "}
                {formatRelativeTime(version.created_at)}
              </span>
            </div>
            {article.status !== "locked" ? (
              <div className="mt-2">
                {openVersion === version.version ? (
                  <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      onRestore(version.version, reason);
                      setOpenVersion(null);
                      setReason("");
                    }}
                  >
                    <TextInput
                      id={`restore-reason-${version.version}`}
                      label="Reason for restoring"
                      onChange={(event) => setReason(event.target.value)}
                      value={reason}
                    />
                    <Button disabled={reason.trim().length < 3} size="md" type="submit">
                      Restore v{version.version}
                    </Button>
                    <Button
                      onClick={() => setOpenVersion(null)}
                      size="md"
                      type="button"
                      variant="ghost"
                    >
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <Button
                    onClick={() => setOpenVersion(version.version)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <ArrowsClockwiseIcon aria-hidden="true" className="h-4 w-4" />
                    Restore this version
                  </Button>
                )}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Wraps the current selection with Markdown delimiters (or drops the caret
 * between an empty pair), then restores focus and selection to the editor.
 * The toolbar only renders while the textarea exists, so `#edit-body` is
 * always reachable when this runs.
 */
function applyMarkdown(
  body: string,
  setBody: (next: string) => void,
  before: string,
  after: string,
) {
  const textarea = document.getElementById("edit-body") as HTMLTextAreaElement | null;
  const start = textarea?.selectionStart ?? body.length;
  const end = textarea?.selectionEnd ?? body.length;
  const selected = body.slice(start, end);

  setBody(body.slice(0, start) + before + selected + after + body.slice(end));

  requestAnimationFrame(() => {
    if (!textarea) return;
    textarea.focus();
    const contentStart = start + before.length;
    textarea.setSelectionRange(contentStart, contentStart + selected.length);
  });
}

function ToolbarItem({
  Icon,
  label,
  onInsert,
  disabled,
}: {
  Icon: PhosphorIcon;
  label: string;
  onInsert: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      aria-label={label}
      className="text-fg-muted hover:bg-bg-raised hover:text-fg focus-visible:ring-border-focus inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
      disabled={disabled}
      onClick={onInsert}
      title={label}
      type="button"
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}
