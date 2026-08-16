import type { Json } from "@/lib/database.types";
import { SETTING_VALUE_TYPES, type SettingValueType } from "@/lib/actions/settings";

/**
 * Normalized read projection of `admin_get_site_settings`.
 *
 * The RPC is SECURITY DEFINER and permission-gated, so rows are trusted; this
 * module only shapes them and drops anything that cannot be rendered safely.
 * Unknown keys are kept (a newer deployment may seed settings this build does
 * not know about) and fall back to a humanized label in the UI.
 */

const KEY_PATTERN = /^[a-z0-9]+(\.[a-z0-9_]+)*$/;
const valueTypeSet = new Set<string>(SETTING_VALUE_TYPES);

export interface SiteSettingDto {
  description: string | null;
  isPublic: boolean;
  key: string;
  maxValue: number | null;
  minValue: number | null;
  value: Json;
  valueType: SettingValueType;
}

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

function finiteNumberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeSettingsRow(value: unknown): SiteSettingDto | null {
  if (!isRecord(value)) return null;

  const key = boundedText(value.key, 60, 2)?.toLowerCase();
  const valueType =
    typeof value.value_type === "string" && valueTypeSet.has(value.value_type)
      ? (value.value_type as SettingValueType)
      : null;

  if (!key || !KEY_PATTERN.test(key) || !valueType) {
    return null;
  }

  const rawValue = value.value;
  const matchesType =
    (valueType === "string" && typeof rawValue === "string") ||
    (valueType === "number" && typeof rawValue === "number") ||
    (valueType === "boolean" && typeof rawValue === "boolean") ||
    (valueType === "json" && isRecord(rawValue)) ||
    (valueType === "array" && Array.isArray(rawValue));

  if (!matchesType) {
    return null;
  }

  return {
    description: boundedText(value.description, 500),
    isPublic: value.is_public === true,
    key,
    maxValue: finiteNumberOrNull(value.max_value),
    minValue: finiteNumberOrNull(value.min_value),
    value: rawValue as Json,
    valueType,
  };
}

export function normalizeSettingsRows(value: unknown): SiteSettingDto[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 200).flatMap((row) => {
    const normalized = normalizeSettingsRow(row);
    return normalized ? [normalized] : [];
  });
}
