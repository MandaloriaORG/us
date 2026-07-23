import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import {
  countUnacknowledgedWarnings,
  listOwnWarnings,
  listUserNotes,
  NOTE_PAGE_SIZE,
  type UserNote,
} from "@/lib/content/user-moderation";

const userId = "40000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});

function noteRow(index: number): UserNote {
  return {
    note_id: `60000000-0000-4000-8000-00000000000${index}`,
    body: `Note ${index}`,
    actor_id: "40000000-0000-4000-8000-000000000009",
    actor_display_name: "Guardian",
    created_at: `2026-07-2${index}T10:00:00.000Z`,
    updated_at: `2026-07-2${index}T10:00:00.000Z`,
  };
}

describe("listOwnWarnings", () => {
  it("takes no id, so it cannot be pointed at somebody else", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await listOwnWarnings();

    expect(mocks.rpc).toHaveBeenCalledWith("list_own_warnings");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("returns the rows the RPC produced", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          warning_id: "x",
          reason: "Off topic",
          acknowledged_at: null,
          created_at: "2026-07-23T10:00:00Z",
        },
      ],
      error: null,
    });

    await expect(listOwnWarnings()).resolves.toHaveLength(1);
  });

  it("returns nothing rather than leaking a database failure", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "denied" } });

    await expect(listOwnWarnings()).resolves.toEqual([]);
  });
});

describe("countUnacknowledgedWarnings", () => {
  it("counts only what the member has not acknowledged", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        { warning_id: "a", reason: "one", acknowledged_at: null, created_at: "2026-07-23" },
        {
          warning_id: "b",
          reason: "two",
          acknowledged_at: "2026-07-23T10:00:00Z",
          created_at: "2026-07-22",
        },
        { warning_id: "c", reason: "three", acknowledged_at: null, created_at: "2026-07-21" },
      ],
      error: null,
    });

    await expect(countUnacknowledgedWarnings()).resolves.toBe(2);
  });

  it("is zero when the read failed, so a fault never looks like a warning", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "denied" } });

    await expect(countUnacknowledgedWarnings()).resolves.toBe(0);
  });
});

describe("listUserNotes", () => {
  it("asks for one subject's notes with the default page size", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await listUserNotes(userId);

    expect(mocks.rpc).toHaveBeenCalledWith("council_list_user_notes", {
      p_user_id: userId,
      p_cursor_created_at: undefined,
      p_cursor_id: undefined,
      p_limit: NOTE_PAGE_SIZE,
    });
  });

  it("returns no cursor when the page is short", async () => {
    mocks.rpc.mockResolvedValue({ data: [noteRow(1)], error: null });

    await expect(listUserNotes(userId)).resolves.toEqual({
      items: [noteRow(1)],
      nextCursor: null,
    });
  });

  it("returns a cursor built from the last row when the page is full", async () => {
    const rows = [noteRow(1), noteRow(2)];
    mocks.rpc.mockResolvedValue({ data: rows, error: null });

    const page = await listUserNotes(userId, { pageSize: 2 });

    expect(page.nextCursor).toBe(`${rows[1].created_at}~${rows[1].note_id}`);
  });

  it("round-trips its own cursor back into the RPC arguments", async () => {
    const rows = [noteRow(1), noteRow(2)];
    mocks.rpc.mockResolvedValue({ data: rows, error: null });

    const first = await listUserNotes(userId, { pageSize: 2 });
    await listUserNotes(userId, { pageSize: 2, cursor: first.nextCursor });

    expect(mocks.rpc).toHaveBeenLastCalledWith(
      "council_list_user_notes",
      expect.objectContaining({
        p_cursor_created_at: rows[1].created_at,
        p_cursor_id: rows[1].note_id,
      }),
    );
  });

  it("degrades a corrupt cursor to the first page instead of failing", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await listUserNotes(userId, { cursor: "garbage" });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "council_list_user_notes",
      expect.objectContaining({ p_cursor_created_at: undefined, p_cursor_id: undefined }),
    );
  });

  it.each([
    [0, 1],
    [-3, 1],
    [400, 100],
  ])("bounds a page size of %s to %s", async (requested, expected) => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await listUserNotes(userId, { pageSize: requested });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "council_list_user_notes",
      expect.objectContaining({ p_limit: expected }),
    );
  });

  it("returns an empty page rather than throwing when the caller is refused", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "denied" } });

    await expect(listUserNotes(userId)).resolves.toEqual({ items: [], nextCursor: null });
  });
});
