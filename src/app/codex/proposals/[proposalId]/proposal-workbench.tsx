"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowsClockwiseIcon,
  CheckCircleIcon,
  PlusIcon,
  ProhibitIcon,
  TrashIcon,
  UserPlusIcon,
} from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/origin/native-select";
import { TextInput } from "@/components/origin/text-input";
import { Textarea } from "@/components/origin/textarea";
import {
  addProposalSource,
  assignProposal,
  removeProposalSource,
  replaceProposal,
  setProposalContributorStatus,
  updateProposalStatus,
  upsertProposalContributor,
  publishProposalWithArticle,
} from "@/lib/actions/codex";
import {
  ATTRIBUTION_LABELS,
  CONTRIBUTION_TYPE_LABELS,
  type CodexContributionType,
  type CodexAttribution,
} from "@/lib/codex/states";
import type { ProposalContributor, ProposalDetail, ProposalSource } from "@/lib/codex/queries";

interface ProposalWorkbenchProps {
  canEdit: boolean;
  contributors: ProposalContributor[];
  isProposer: boolean;
  proposal: ProposalDetail;
  sources: ProposalSource[];
}

export function ProposalWorkbench({
  canEdit,
  contributors,
  isProposer,
  proposal,
  sources,
}: ProposalWorkbenchProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result && typeof result === "object" && "ok" in result && !result.ok) {
        const failure = result as { message?: unknown };
        setError(typeof failure.message === "string" ? failure.message : "Something went wrong.");
        return;
      }
      router.refresh();
    });
  }

  const transition = (status: string, reason = "") =>
    run(() =>
      updateProposalStatus({
        proposalId: proposal.proposal_id,
        expectedStatus: proposal.status,
        status,
        reason,
      }),
    );

  return (
    <section aria-labelledby="workbench-heading" className="border-border mt-6 border-t pt-4">
      <h2 className="text-fg text-base font-semibold" id="workbench-heading">
        {canEdit ? "Archivist workbench" : "Your proposal"}
      </h2>

      {error ? (
        <p className="text-error mt-2 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-4">
        {canEdit ? <ArchivistTransitions proposal={proposal} onAction={transition} /> : null}
        {canEdit && proposal.status === "reviewed" ? (
          <PublishProposalForm proposalId={proposal.proposal_id} expectedStatus={proposal.status} />
        ) : null}
        {canEdit ? <AssignArchivistForm proposalId={proposal.proposal_id} /> : null}
        {isProposer && !canEdit ? (
          <div className="flex flex-wrap gap-2">
            <ReasonActionButton
              actionLabel="Withdraw proposal"
              confirmLabel="Withdraw"
              icon={<ProhibitIcon aria-hidden="true" className="h-4 w-4" />}
              onConfirm={(reason) =>
                run(() =>
                  updateProposalStatus({
                    proposalId: proposal.proposal_id,
                    expectedStatus: proposal.status,
                    status: "withdrawn",
                    reason,
                  }),
                )
              }
              pending={pending}
              title="Withdraw"
            />
          </div>
        ) : null}

        <AddSourceForm proposalId={proposal.proposal_id} />

        {sources.length > 0 ? (
          <RemoveSources canEdit={canEdit} proposalId={proposal.proposal_id} sources={sources} />
        ) : null}

        <AddContributorForm proposalId={proposal.proposal_id} />

        {canEdit && contributors.length > 0 ? (
          <ConfirmContributors contributors={contributors} proposalId={proposal.proposal_id} />
        ) : null}
      </div>
    </section>
  );
}

const ARCHIVIST_TRANSITIONS: {
  label: string;
  from: string[];
  to: string;
  requiresReason?: boolean;
}[] = [
  { label: "Classify", from: ["proposed", "reopened"], to: "classified" },
  { label: "Start drafting", from: ["classified"], to: "drafting" },
  { label: "Send for review", from: ["drafting"], to: "reviewed" },
  {
    label: "Reject",
    from: ["proposed", "classified", "drafting", "reviewed", "reopened"],
    to: "rejected",
    requiresReason: true,
  },
  { label: "Reopen", from: ["rejected", "withdrawn"], to: "reopened" },
];

function ArchivistTransitions({
  proposal,
  onAction,
}: {
  proposal: ProposalDetail;
  onAction: (status: string, reason?: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ARCHIVIST_TRANSITIONS.filter((t) => t.from.includes(proposal.status)).map((t) => (
        <ReasonActionButton
          actionLabel={t.label}
          confirmLabel={t.label}
          key={t.to}
          onConfirm={(reason) => onAction(t.to, reason)}
          requiresReason={t.requiresReason}
        />
      ))}
      {proposal.status === "published" ? (
        <ReplaceProposalForm proposalId={proposal.proposal_id} />
      ) : null}
      <Button asChild variant="secondary" size="md">
        <Link
          href={`/council/codex/new?title=${encodeURIComponent(proposal.working_title ?? "")}&proposal=${proposal.proposal_id}`}
        >
          <PlusIcon aria-hidden="true" className="h-4 w-4" />
          Create draft from proposal
        </Link>
      </Button>
    </div>
  );
}

function PublishProposalForm({
  proposalId,
  expectedStatus,
}: {
  proposalId: string;
  expectedStatus: string;
}) {
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await publishProposalWithArticle({
        proposalId,
        expectedStatus,
        articleSlug: slug.trim(),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form
      className="border-border bg-surface flex flex-col gap-2 rounded-md border p-4"
      onSubmit={onSubmit}
    >
      <p className="text-fg text-sm font-medium">Publish the reviewed article</p>
      <p className="text-fg-muted text-xs">
        Publish the article from the Council editor first, then enter its slug. The proposal links
        to it and never publishes itself.
      </p>
      <TextInput
        error={error ?? undefined}
        id="proposal-article-slug"
        label="Article slug"
        onChange={(event) => setSlug(event.target.value)}
        placeholder="the-vows"
        value={slug}
      />
      <div>
        <Button disabled={pending} loading={pending} size="md" type="submit">
          Publish proposal
        </Button>
      </div>
    </form>
  );
}

function AssignArchivistForm({ proposalId }: { proposalId: string }) {
  const [assigneeId, setAssigneeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await assignProposal({
        proposalId,
        assigneeId: assigneeId.trim(),
        reason: "Assigned from the proposal workbench",
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setAssigneeId("");
      router.refresh();
    });
  }

  return (
    <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={onSubmit}>
      <TextInput
        className="sm:max-w-64"
        error={error ?? undefined}
        id="proposal-assignee"
        label="Assign an Archivist (profile id)"
        onChange={(event) => setAssigneeId(event.target.value)}
        placeholder="00000000-0000-4000-8000-000000000000"
        value={assigneeId}
      />
      <Button disabled={pending || !assigneeId} loading={pending} size="md" type="submit">
        Assign
      </Button>
    </form>
  );
}

function AddSourceForm({ proposalId }: { proposalId: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"post" | "comment" | "external">("external");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <div>
        <Button onClick={() => setOpen(true)} type="button" variant="ghost">
          <PlusIcon aria-hidden="true" className="h-4 w-4" />
          Add a source
        </Button>
      </div>
    );
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addProposalSource({
        proposalId,
        note,
        source:
          type === "post"
            ? { postId: value.trim() }
            : type === "comment"
              ? { commentId: value.trim() }
              : { externalUrl: value.trim() },
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setValue("");
      setNote("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <NativeSelect
          id={`source-type-${proposalId}`}
          label="Type"
          onChange={(event) => setType(event.target.value as typeof type)}
          value={type}
        >
          <option value="post">Post</option>
          <option value="comment">Comment</option>
          <option value="external">External link</option>
        </NativeSelect>
        <TextInput
          error={error ?? undefined}
          id={`source-value-${proposalId}`}
          label={type === "external" ? "URL" : "Content id"}
          onChange={(event) => setValue(event.target.value)}
          placeholder={type === "external" ? "https://…" : "00000000-0000-4000-8000-000000000000"}
          value={value}
        />
      </div>
      <TextInput
        id={`source-note-${proposalId}`}
        label="Note (optional fragment or thread used)"
        onChange={(event) => setNote(event.target.value)}
        value={note}
      />
      <div className="flex gap-2">
        <Button disabled={pending || !value} loading={pending} size="md" type="submit">
          Add source
        </Button>
        <Button onClick={() => setOpen(false)} size="md" type="button" variant="ghost">
          Cancel
        </Button>
      </div>
    </form>
  );
}

function RemoveSources({
  canEdit,
  proposalId,
  sources,
}: {
  canEdit: boolean;
  proposalId: string;
  sources: ProposalSource[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Only sources the caller added, or any source for an Archivist.
  const removable = canEdit ? sources : sources.filter((s) => s.is_visible);
  const [error, setError] = useState<string | null>(null);

  if (removable.length === 0) return null;

  function remove(sourceId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeProposalSource({ proposalId, sourceId });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      {error ? (
        <p className="text-error text-xs" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="flex flex-col gap-1">
        {removable.map((source) => (
          <li className="flex items-center gap-2 text-sm" key={source.source_id}>
            <span className="text-fg-muted">{source.label || "Restricted source"}</span>
            <Button
              aria-label="Remove source"
              disabled={pending}
              onClick={() => remove(source.source_id)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <TrashIcon aria-hidden="true" className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddContributorForm({ proposalId }: { proposalId: string }) {
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [type, setType] = useState<CodexContributionType>("explanation");
  // Anonymous by default: naming someone publicly is an explicit choice the
  // Archivist makes, so a skipped dropdown never credits a member by name
  // without their consent.
  const [attribution, setAttribution] = useState<CodexAttribution>("anonymous");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <div>
        <Button onClick={() => setOpen(true)} type="button" variant="ghost">
          <UserPlusIcon aria-hidden="true" className="h-4 w-4" />
          Recognize a contributor
        </Button>
      </div>
    );
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await upsertProposalContributor({
        proposalId,
        memberId: memberId.trim(),
        contributionType: type,
        attribution,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMemberId("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextInput
          className="sm:col-span-3"
          error={error ?? undefined}
          id={`contributor-member-${proposalId}`}
          label="Member (profile id)"
          onChange={(event) => setMemberId(event.target.value)}
          placeholder="00000000-0000-4000-8000-000000000000"
          value={memberId}
        />
        <NativeSelect
          id={`contributor-type-${proposalId}`}
          label="Contribution"
          onChange={(event) => setType(event.target.value as CodexContributionType)}
          value={type}
        >
          {Object.entries(CONTRIBUTION_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          id={`contributor-attribution-${proposalId}`}
          label="Attribution"
          onChange={(event) => setAttribution(event.target.value as CodexAttribution)}
          value={attribution}
        >
          {Object.entries(ATTRIBUTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <p className="text-fg-muted text-xs">
        Anonymous by default — choose Public only with the member&apos;s consent to be named.
      </p>
      <div className="flex gap-2">
        <Button disabled={pending || !memberId} loading={pending} size="md" type="submit">
          Add contributor
        </Button>
        <Button onClick={() => setOpen(false)} size="md" type="button" variant="ghost">
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ConfirmContributors({
  contributors,
  proposalId,
}: {
  contributors: ProposalContributor[];
  proposalId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function setStatus(memberId: string, expectedStatus: string, status: string, reason: string) {
    setError(null);
    startTransition(async () => {
      const result = await setProposalContributorStatus({
        proposalId,
        memberId,
        expectedStatus,
        status,
        reason,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p className="text-error text-xs" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {contributors.map((contributor) => (
          <li
            className="border-border flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm"
            key={contributor.contributor_id}
          >
            <span className="text-fg">
              {contributor.member_display_name || "Withdrawn contributor"}
            </span>
            <span className="text-fg-muted">
              {CONTRIBUTION_TYPE_LABELS[contributor.contribution_type]} ·{" "}
              {ATTRIBUTION_LABELS[contributor.attribution].toLowerCase()} · {contributor.status}
            </span>
            <div className="ml-auto flex gap-1">
              {contributor.status !== "confirmed" ? (
                <Button
                  onClick={() =>
                    setStatus(
                      contributor.member_id,
                      contributor.status,
                      "confirmed",
                      "Confirmed by the Archivist",
                    )
                  }
                  disabled={pending}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  <CheckCircleIcon aria-hidden="true" className="h-4 w-4" />
                  Confirm
                </Button>
              ) : null}
              {contributor.status === "proposed" ? (
                <Button
                  onClick={() =>
                    setStatus(
                      contributor.member_id,
                      contributor.status,
                      "rejected",
                      "Rejected by the Archivist",
                    )
                  }
                  disabled={pending}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <ProhibitIcon aria-hidden="true" className="h-4 w-4" />
                  Reject
                </Button>
              ) : null}
              {contributor.status !== "withdrawn" && contributor.status !== "rejected" ? (
                <Button
                  onClick={() =>
                    setStatus(
                      contributor.member_id,
                      contributor.status,
                      "withdrawn",
                      "Attribution withdrawn",
                    )
                  }
                  disabled={pending}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <ArrowsClockwiseIcon aria-hidden="true" className="h-4 w-4" />
                  Withdraw
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReplaceProposalForm({ proposalId }: { proposalId: string }) {
  const [open, setOpen] = useState(false);
  const [replacedBy, setReplacedBy] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} type="button" variant="ghost">
        <ArrowsClockwiseIcon aria-hidden="true" className="h-4 w-4" />
        Replace
      </Button>
    );
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await replaceProposal({ proposalId, replacedBy: replacedBy.trim(), reason });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form className="border-border flex flex-col gap-2 rounded-md border p-3" onSubmit={onSubmit}>
      <p className="text-fg text-sm font-medium">Replace this published proposal</p>
      <TextInput
        error={error ?? undefined}
        id="replace-by"
        label="Replacing proposal id"
        onChange={(event) => setReplacedBy(event.target.value)}
        value={replacedBy}
      />
      <Textarea
        aria-label="Reason for replacing"
        id="replace-reason"
        onChange={(event) => setReason(event.target.value)}
        rows={2}
        value={reason}
      />
      <div className="flex gap-2">
        <Button disabled={pending || !replacedBy} loading={pending} size="sm" type="submit">
          Replace
        </Button>
        <Button onClick={() => setOpen(false)} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ReasonActionButton({
  actionLabel,
  confirmLabel,
  icon,
  onConfirm,
  pending,
  requiresReason,
  title,
}: {
  actionLabel: string;
  confirmLabel: string;
  icon?: React.ReactNode;
  onConfirm: (reason: string) => void;
  pending?: boolean;
  requiresReason?: boolean;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (!open) {
    return (
      <Button
        disabled={pending}
        onClick={() => setOpen(true)}
        size="md"
        title={title}
        type="button"
        variant={requiresReason ? "secondary" : "ghost"}
      >
        {icon}
        {actionLabel}
      </Button>
    );
  }

  return (
    <form
      className="border-border bg-surface flex flex-col gap-2 rounded-md border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm(reason);
        setOpen(false);
      }}
    >
      {requiresReason ? (
        <Textarea
          aria-label={`Reason for ${confirmLabel.toLowerCase()}`}
          autoFocus
          id={`reason-${confirmLabel.toLowerCase()}`}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why?"
          rows={2}
          value={reason}
        />
      ) : null}
      <div className="flex gap-2">
        <Button
          disabled={pending || (requiresReason && reason.trim().length < 3)}
          size="sm"
          type="submit"
        >
          {confirmLabel}
        </Button>
        <Button onClick={() => setOpen(false)} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
      </div>
    </form>
  );
}
