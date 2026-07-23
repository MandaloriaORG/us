import { renderMarkdown } from "@/lib/content/markdown";
import { listCommentRevisions, listPostRevisions } from "@/lib/content/revisions";
import { formatRelativeTime } from "@/lib/time";

/**
 * Previous wordings of the reported post or comment.
 *
 * DATA CONTRACT — implemented:
 * - `list_content_revisions` re-checks that the caller is the author or holds
 *   `moderation.hide`, and answers "does not exist" otherwise. A refused read
 *   arrives here as an empty history, which renders as nothing — the page must
 *   not distinguish "never edited" from "not yours to read".
 * - A revision is the wording *before* an edit, newest first, bounded to the 50
 *   most recent. Creating content writes none, and an edit that changed nothing
 *   writes none, so an empty history really does mean the wording is original.
 * - `title` is null for a comment revision; `editor_display_name` is null when
 *   that account is gone, because the revision is evidence about the content and
 *   outlives the editor.
 *
 * DESIGN:
 * - Evidence a moderator needs only when the wording is disputed, so it is a
 *   native disclosure under the evidence, not a second panel competing with it.
 * - Bodies are author text and go through `renderMarkdown`, like the evidence.
 */
interface RevisionHistoryProps {
  targetType: string;
  targetId: string;
}

export async function RevisionHistory({ targetType, targetId }: RevisionHistoryProps) {
  if (targetType !== "post" && targetType !== "comment") return null;

  const revisions =
    targetType === "post"
      ? await listPostRevisions(targetId)
      : await listCommentRevisions(targetId);

  if (revisions.length === 0) return null;

  return (
    <details className="border-border mt-4 border-t pt-4">
      <summary className="text-fg-muted hover:text-fg focus-visible:ring-border-focus flex min-h-11 cursor-pointer items-center text-sm focus-visible:ring-2 focus-visible:outline-hidden">
        Edit history ({revisions.length}
        {revisions.length === 1 ? " earlier version" : " earlier versions"})
      </summary>

      <ol className="mt-2">
        {revisions.map((revision) => (
          <li key={revision.revision_id} className="border-border mt-4 border-l pl-4">
            <p className="text-fg-subtle text-xs">
              {revision.editor_display_name ?? "Account removed"} ·{" "}
              {formatRelativeTime(revision.created_at)}
            </p>
            {revision.title ? (
              <p className="text-fg mt-1 text-sm font-medium wrap-break-word">{revision.title}</p>
            ) : null}
            {/* Safe by construction: `renderMarkdown` escapes author text first. */}
            <div
              className="text-fg-muted mt-2 text-sm leading-relaxed break-words"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(revision.body) }}
            />
          </li>
        ))}
      </ol>
    </details>
  );
}
