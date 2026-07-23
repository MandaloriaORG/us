/**
 * Relative age formatting shared by post rows and comments. Uses the
 * platform's own `Intl.RelativeTimeFormat` rather than a date library.
 */

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const seconds = Math.round((now.getTime() - then) / 1000);
  if (seconds < 60) return "just now";

  for (const [unit, unitSeconds] of UNITS) {
    if (seconds >= unitSeconds) {
      return formatter.format(-Math.round(seconds / unitSeconds), unit);
    }
  }

  return formatter.format(-Math.round(seconds / 60), "minute");
}
