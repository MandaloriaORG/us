import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import {
  getReport,
  listReports,
  parseReportStatus,
  REPORT_PAGE_SIZE,
  type ReportSummary,
} from "@/lib/content/reports";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});

function reportRow(index: number): ReportSummary {
  return {
    report_id: `70000000-0000-4000-8000-00000000000${index}`,
    target_type: "post",
    target_id: "20000000-0000-4000-8000-000000000001",
    reason: "spam",
    details: "Repeated advertising.",
    status: "open",
    reporter_id: "40000000-0000-4000-8000-000000000001",
    reporter_display_name: "Reporter",
    target_author_id: "40000000-0000-4000-8000-000000000002",
    target_author_display_name: "Author",
    target_excerpt: "A reportable post",
    open_report_count: 1,
    resolution: null,
    resolved_by: null,
    resolved_at: null,
    created_at: `2026-07-2${index}T10:00:00.000Z`,
  };
}

describe("parseReportStatus", () => {
  it.each(["open", "under_review", "resolved", "dismissed"])("accepts %s", (status) => {
    expect(parseReportStatus(status)).toBe(status);
  });

  it("reads 'all' as no filter", () => {
    expect(parseReportStatus("all")).toBeNull();
  });

  it.each([undefined, "", "everything", ["open"], "OPEN"])(
    "falls back to the open queue for %s",
    (value) => {
      expect(parseReportStatus(value as string | string[] | undefined)).toBe("open");
    },
  );
});

describe("listReports", () => {
  it("asks for the open queue by default", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await listReports();

    expect(mocks.rpc).toHaveBeenCalledWith("moderation_list_reports", {
      p_status: "open",
      p_cursor_created_at: undefined,
      p_cursor_id: undefined,
      p_limit: REPORT_PAGE_SIZE,
    });
  });

  it("sends null, not an omitted argument, when every status is wanted", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await listReports({ status: null });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "moderation_list_reports",
      expect.objectContaining({ p_status: null }),
    );
  });

  it("returns no cursor when the page is short", async () => {
    mocks.rpc.mockResolvedValue({ data: [reportRow(1)], error: null });

    const page = await listReports();

    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  it("returns a cursor built from the last row when the page is full", async () => {
    const rows = Array.from({ length: 3 }, (_, index) => reportRow(index + 1));
    mocks.rpc.mockResolvedValue({ data: rows, error: null });

    const page = await listReports({ pageSize: 3 });

    expect(page.nextCursor).toBe(`${rows[2].created_at}~${rows[2].report_id}`);
  });

  it("round-trips its own cursor back into the RPC arguments", async () => {
    const rows = Array.from({ length: 2 }, (_, index) => reportRow(index + 1));
    mocks.rpc.mockResolvedValue({ data: rows, error: null });

    const first = await listReports({ pageSize: 2 });
    await listReports({ pageSize: 2, cursor: first.nextCursor });

    expect(mocks.rpc).toHaveBeenLastCalledWith(
      "moderation_list_reports",
      expect.objectContaining({
        p_cursor_created_at: rows[1].created_at,
        p_cursor_id: rows[1].report_id,
      }),
    );
  });

  it("degrades a corrupt cursor to the first page instead of failing", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await listReports({ cursor: "not~a~cursor" });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "moderation_list_reports",
      expect.objectContaining({ p_cursor_created_at: undefined, p_cursor_id: undefined }),
    );
  });

  it.each([
    [0, 1],
    [-5, 1],
    [500, 100],
  ])("bounds a page size of %s to %s", async (requested, expected) => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await listReports({ pageSize: requested });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "moderation_list_reports",
      expect.objectContaining({ p_limit: expected }),
    );
  });

  it("returns an empty page rather than throwing when the caller is refused", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "denied" } });

    await expect(listReports()).resolves.toEqual({ items: [], nextCursor: null });
  });
});

describe("getReport", () => {
  it("returns the single row the RPC produced", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ report_id: "x" }], error: null });

    await expect(getReport("70000000-0000-4000-8000-000000000001")).resolves.toMatchObject({
      report_id: "x",
    });
  });

  it("returns null when the report is not there", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await expect(getReport("70000000-0000-4000-8000-000000000001")).resolves.toBeNull();
  });

  it("returns null rather than leaking a database failure", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "denied" } });

    await expect(getReport("70000000-0000-4000-8000-000000000001")).resolves.toBeNull();
  });
});
