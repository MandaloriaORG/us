// PostgreSQL's uuid type guarantees the canonical textual shape, but does not
// restrict UUID version or variant bits. Historical identifiers must not be
// dropped merely because they predate the application's current generators.
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const timestampPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-](\d{2}):(\d{2}))$/;

const profileStatuses = ["active", "suspended", "banned"] as const;

export type AuditProfileStatus = (typeof profileStatuses)[number];

export interface AuditLogDto {
  action: string;
  actionLabel: string;
  actorDisplayName: string;
  actorId: string;
  createdAt: string;
  id: string;
  newStatus: AuditProfileStatus | null;
  oldStatus: AuditProfileStatus | null;
  reason: string | null;
  roleName: string | null;
  targetDisplayName: string;
  targetId: string | null;
  targetType: string;
  totalCount: number;
}

const actionLabels: Readonly<Record<string, string>> = {
  "user.banned": "Member banned",
  "user.role_assigned": "Role assigned",
  "user.role_removed": "Role removed",
  "user.suspended": "Member suspended",
  "user.unbanned": "Member restored",
  "user.unsuspended": "Member restored",
};

const statusLabels: Readonly<Record<AuditProfileStatus, string>> = {
  active: "Active",
  banned: "Banned",
  suspended: "Suspended",
};

const targetFallbacks: Readonly<Record<string, string>> = {
  article: "Deleted article",
  plaza: "Deleted Plaza",
  role: "Deleted role",
  user: "Deleted member",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, maximumLength: number, minimumLength = 1) {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return normalized.length >= minimumLength && normalized.length <= maximumLength
    ? normalized
    : null;
}

function normalizeUuid(value: unknown) {
  return typeof value === "string" && uuidPattern.test(value) ? value : null;
}

function normalizeKey(value: unknown, minimumLength: number, maximumLength: number) {
  if (typeof value !== "string") return null;

  return value.length >= minimumLength && value.length <= maximumLength ? value : null;
}

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "string") return null;

  const match = timestampPattern.exec(value);
  if (!match) return null;

  const [
    ,
    rawYear,
    rawMonth,
    rawDay,
    rawHour,
    rawMinute,
    rawSecond,
    rawOffsetHour,
    rawOffsetMinute,
  ] = match;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  const second = Number(rawSecond);
  const offsetHour = rawOffsetHour === undefined ? 0 : Number(rawOffsetHour);
  const offsetMinute = rawOffsetMinute === undefined ? 0 : Number(rawOffsetMinute);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeStatus(value: unknown): AuditProfileStatus | null {
  return typeof value === "string" && profileStatuses.includes(value as AuditProfileStatus)
    ? (value as AuditProfileStatus)
    : null;
}

function normalizeCount(value: unknown) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  }

  if (typeof value === "string" && /^(?:0|[1-9]\d*)$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : 0;
  }

  return 0;
}

export function getAuditActionLabel(action: string) {
  return actionLabels[action] ?? "Administrative action";
}

export function getAuditTargetFallback(targetType: string) {
  return targetFallbacks[targetType] ?? "Deleted target";
}

export function getAuditActionDetail(
  audit: Pick<AuditLogDto, "action" | "newStatus" | "oldStatus" | "roleName">,
) {
  switch (audit.action) {
    case "user.banned":
    case "user.suspended":
    case "user.unbanned":
    case "user.unsuspended":
      if (audit.oldStatus && audit.newStatus) {
        return `Status changed from ${statusLabels[audit.oldStatus]} to ${statusLabels[audit.newStatus]}`;
      }
      return null;
    case "user.role_assigned":
      return audit.roleName ? `Assigned role: ${audit.roleName}` : null;
    case "user.role_removed":
      return audit.roleName ? `Removed role: ${audit.roleName}` : null;
    default:
      return null;
  }
}

export function normalizeAuditLogRow(value: unknown): AuditLogDto | null {
  if (!isRecord(value)) return null;

  const id = normalizeUuid(value.id);
  const actorId = normalizeUuid(value.actor_id);
  const action = normalizeKey(value.action, 3, 100);
  const targetType = normalizeKey(value.target_type, 2, 50);
  const createdAt = normalizeTimestamp(value.created_at);
  const targetId = value.target_id === null ? null : normalizeUuid(value.target_id);

  if (
    !id ||
    !actorId ||
    !action ||
    !targetType ||
    !createdAt ||
    (targetId === null && value.target_id !== null)
  ) {
    return null;
  }

  const actorDisplayName = boundedText(value.actor_display_name, 50) ?? "Deleted member";
  const targetDisplayName =
    boundedText(value.target_display_name, 50) ?? getAuditTargetFallback(targetType);

  return {
    action,
    actionLabel: getAuditActionLabel(action),
    actorDisplayName,
    actorId,
    createdAt,
    id,
    newStatus: normalizeStatus(value.new_status),
    oldStatus: normalizeStatus(value.old_status),
    reason: boundedText(value.reason, 500, 3),
    roleName: boundedText(value.role_name, 50),
    targetDisplayName,
    targetId,
    targetType,
    totalCount: normalizeCount(value.total_count),
  };
}

export function normalizeAuditLogRows(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 100).flatMap((row) => {
    const normalized = normalizeAuditLogRow(row);
    return normalized ? [normalized] : [];
  });
}

export function getAuditLogTotal(value: unknown) {
  if (!Array.isArray(value)) return 0;

  for (const row of value.slice(0, 100)) {
    const normalized = normalizeAuditLogRow(row);
    if (normalized) return normalized.totalCount;
  }

  return 0;
}
