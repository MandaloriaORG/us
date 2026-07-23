import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "@/lib/time";

const now = new Date("2026-07-23T12:00:00.000Z");

describe("formatRelativeTime", () => {
  it("reports very recent times as just now", () => {
    expect(formatRelativeTime(new Date("2026-07-23T11:59:45.000Z").toISOString(), now)).toBe(
      "just now",
    );
  });

  it("picks minutes, hours, days, weeks, months and years in descending order", () => {
    expect(formatRelativeTime(new Date("2026-07-23T11:55:00.000Z").toISOString(), now)).toBe(
      "5 minutes ago",
    );
    expect(formatRelativeTime(new Date("2026-07-23T09:00:00.000Z").toISOString(), now)).toBe(
      "3 hours ago",
    );
    expect(formatRelativeTime(new Date("2026-07-21T12:00:00.000Z").toISOString(), now)).toBe(
      "2 days ago",
    );
    expect(formatRelativeTime(new Date("2026-07-02T12:00:00.000Z").toISOString(), now)).toBe(
      "3 weeks ago",
    );
    expect(formatRelativeTime(new Date("2026-05-23T12:00:00.000Z").toISOString(), now)).toBe(
      "2 months ago",
    );
    expect(formatRelativeTime(new Date("2024-07-23T12:00:00.000Z").toISOString(), now)).toBe(
      "2 years ago",
    );
  });

  it("returns an empty string for an unparseable date", () => {
    expect(formatRelativeTime("not-a-date", now)).toBe("");
  });
});
