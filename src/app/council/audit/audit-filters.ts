export const auditActions = [
  "user.suspended",
  "user.unsuspended",
  "user.banned",
  "user.unbanned",
  "user.role_assigned",
  "user.role_removed",
] as const;

export const auditPageSize = 50;
export const auditMaxPage = 20_001;

export type AuditAction = (typeof auditActions)[number];
export type AuditFilterField = "action" | "actor" | "target" | "from" | "to" | "page";

type SearchParamValue = string | string[] | undefined;

export interface AuditFilterSearchParams {
  action?: SearchParamValue;
  actor?: SearchParamValue;
  from?: SearchParamValue;
  page?: SearchParamValue;
  target?: SearchParamValue;
  to?: SearchParamValue;
}

export interface AuditFilterValues {
  action: string;
  actor: string;
  from: string;
  page: string;
  target: string;
  to: string;
}

export interface AuditRpcArgs {
  p_action: AuditAction | undefined;
  p_actor_id: string | undefined;
  p_created_before: string | undefined;
  p_created_from: string | undefined;
  p_limit: typeof auditPageSize;
  p_offset: number;
  p_target_id: string | undefined;
}

interface ValidAuditFilters {
  canonicalQuery: string;
  errors: Record<string, never>;
  page: number;
  rpcArgs: AuditRpcArgs;
  valid: true;
  values: AuditFilterValues;
}

interface InvalidAuditFilters {
  errors: Partial<Record<AuditFilterField, string>>;
  valid: false;
  values: AuditFilterValues;
}

export type AuditFilterResult = ValidAuditFilters | InvalidAuditFilters;

interface CalendarDate {
  day: number;
  month: number;
  year: number;
}

const actionSet = new Set<string>(auditActions);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const calendarDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function firstValue(value: SearchParamValue) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseCalendarDate(value: string): CalendarDate | null {
  const match = calendarDatePattern.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }

  return { day, month, year };
}

function nextCalendarDay(value: CalendarDate): CalendarDate {
  if (value.day < daysInMonth(value.year, value.month)) {
    return { ...value, day: value.day + 1 };
  }

  if (value.month < 12) {
    return { day: 1, month: value.month + 1, year: value.year };
  }

  return { day: 1, month: 1, year: value.year + 1 };
}

function utcStart(value: CalendarDate) {
  return `${String(value.year).padStart(4, "0")}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}T00:00:00.000Z`;
}

function compareCalendarDates(left: CalendarDate, right: CalendarDate) {
  return left.year - right.year || left.month - right.month || left.day - right.day;
}

function canonicalQuery(values: AuditFilterValues, page: number) {
  const params = new URLSearchParams();
  if (values.action) params.set("action", values.action);
  if (values.actor) params.set("actor", values.actor);
  if (values.target) params.set("target", values.target);
  if (values.from) params.set("from", values.from);
  if (values.to) params.set("to", values.to);
  if (page > 1) params.set("page", String(page));
  return params.toString();
}

export function parseAuditFilters(searchParams: AuditFilterSearchParams = {}): AuditFilterResult {
  const values: AuditFilterValues = {
    action: firstValue(searchParams.action),
    actor: firstValue(searchParams.actor),
    from: firstValue(searchParams.from),
    page: firstValue(searchParams.page),
    target: firstValue(searchParams.target),
    to: firstValue(searchParams.to),
  };
  const errors: Partial<Record<AuditFilterField, string>> = {};

  const action = values.action
    ? actionSet.has(values.action)
      ? (values.action as AuditAction)
      : undefined
    : undefined;
  if (values.action && !action) {
    errors.action = "Choose a supported audit action.";
  }

  const actorId =
    values.actor && uuidPattern.test(values.actor) ? values.actor.toLowerCase() : undefined;
  if (values.actor && !actorId) {
    errors.actor = "Enter a valid actor ID.";
  }

  const targetId =
    values.target && uuidPattern.test(values.target) ? values.target.toLowerCase() : undefined;
  if (values.target && !targetId) {
    errors.target = "Enter a valid target ID.";
  }

  const fromDate = values.from ? parseCalendarDate(values.from) : null;
  if (values.from && !fromDate) {
    errors.from = "Enter a real date in YYYY-MM-DD format.";
  }

  const toDate = values.to ? parseCalendarDate(values.to) : null;
  if (values.to && !toDate) {
    errors.to = "Enter a real date in YYYY-MM-DD format.";
  }

  if (fromDate && toDate && compareCalendarDates(fromDate, toDate) > 0) {
    errors.to = "The end date must be on or after the start date.";
  }

  let page = 1;
  if (values.page) {
    if (!/^[1-9]\d*$/.test(values.page)) {
      errors.page = `Enter a whole page number from 1 to ${auditMaxPage}.`;
    } else {
      const parsedPage = Number(values.page);
      if (!Number.isSafeInteger(parsedPage) || parsedPage > auditMaxPage) {
        errors.page = `Enter a whole page number from 1 to ${auditMaxPage}.`;
      } else {
        page = parsedPage;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors, valid: false, values };
  }

  return {
    canonicalQuery: canonicalQuery(values, page),
    errors: {},
    page,
    rpcArgs: {
      p_action: action,
      p_actor_id: actorId,
      p_created_before: toDate ? utcStart(nextCalendarDay(toDate)) : undefined,
      p_created_from: fromDate ? utcStart(fromDate) : undefined,
      p_limit: auditPageSize,
      p_offset: (page - 1) * auditPageSize,
      p_target_id: targetId,
    },
    valid: true,
    values,
  };
}
