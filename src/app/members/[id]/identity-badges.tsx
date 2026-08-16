import { CheckCircleIcon, LockIcon, XCircleIcon } from "@phosphor-icons/react/dist/ssr";

import type { BadgeInfo } from "@/lib/clans/types";
import { EVIDENCE_VISIBILITY_LABELS, USER_BADGE_STATUS_LABELS } from "@/lib/clans/labels";

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

interface IdentityBadgesProps {
  badges: BadgeInfo[];
}

/**
 * A member's badge record: name, issuer, date, reason, status and — when the
 * viewer is entitled to it — the evidence reference. Revoked badges stay on
 * the record with who revoked them and why, per the product invariant.
 */
export function IdentityBadges({ badges }: IdentityBadgesProps) {
  if (badges.length === 0) return null;

  return (
    <section className="border-border mt-8 border-t pt-8" aria-labelledby="badges-heading">
      <h2 id="badges-heading" className="text-fg text-sm font-semibold">
        Badges
      </h2>
      <ul className="mt-3 space-y-4">
        {badges.map((badge) => {
          const awardedLabel = dateLabel(badge.awardedAt);
          const revokedLabel = badge.revokedAt ? dateLabel(badge.revokedAt) : null;
          const revoked = badge.status === "revoked";
          const showEvidence = badge.evidenceRef !== null;

          return (
            <li key={badge.id} className="flex gap-3">
              <span
                aria-hidden="true"
                className={
                  revoked ? "text-fg-subtle mt-0.5 shrink-0" : "text-brand-muted mt-0.5 shrink-0"
                }
              >
                {revoked ? (
                  <XCircleIcon className="h-4 w-4" />
                ) : (
                  <CheckCircleIcon className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-fg text-sm font-medium">{badge.name}</p>
                  <span
                    className={
                      revoked
                        ? "border-border text-fg-muted inline-flex rounded-full border px-2 py-0.5 text-[0.6875rem]"
                        : "border-brand/40 bg-brand-muted/10 text-brand inline-flex rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium"
                    }
                  >
                    {USER_BADGE_STATUS_LABELS[badge.status]}
                  </span>
                </div>
                {badge.description ? (
                  <p className="text-fg-muted mt-0.5 text-xs">{badge.description}</p>
                ) : null}
                <p className="text-fg-subtle mt-1 text-xs">
                  Issued by {badge.issuerName}
                  {awardedLabel ? ` · ${awardedLabel}` : ""}
                </p>
                {badge.reason ? (
                  <p className="text-fg-muted mt-1 text-xs leading-relaxed wrap-break-word">
                    {badge.reason}
                  </p>
                ) : null}
                {revoked && revokedLabel ? (
                  <p className="text-error/80 mt-1 text-xs">
                    Revoked on {revokedLabel}
                    {badge.revokedReason ? ` — ${badge.revokedReason}` : ""}
                  </p>
                ) : null}
                {showEvidence ? (
                  <p className="text-fg-subtle mt-1 flex items-center gap-1 text-xs wrap-break-word">
                    {badge.evidenceVisibility === "private" ? (
                      <LockIcon aria-hidden="true" className="h-3 w-3 shrink-0" />
                    ) : null}
                    <span>
                      {EVIDENCE_VISIBILITY_LABELS[badge.evidenceVisibility]} evidence:{" "}
                      {badge.evidenceRef}
                    </span>
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
