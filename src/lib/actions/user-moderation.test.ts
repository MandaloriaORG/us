import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import {
  acknowledgeWarning,
  addUserNote,
  deleteUserNote,
  warnUser,
} from "@/lib/actions/user-moderation";

const userId = "40000000-0000-4000-8000-000000000001";
const warningId = "50000000-0000-4000-8000-000000000001";
const noteId = "60000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});

function rpcReturns(data: unknown) {
  mocks.rpc.mockResolvedValue({ data, error: null });
}

function rpcFails(code: string) {
  mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "database said no" } });
}

describe("warnUser", () => {
  it("normalises the wording before calling the RPC", async () => {
    rpcReturns([{ warning_id: warningId }]);

    const result = await warnUser({ userId, reason: "  Off topic \r\nagain.  " });

    expect(result).toEqual({ ok: true, id: warningId });
    expect(mocks.rpc).toHaveBeenCalledWith("moderation_warn_user", {
      p_user_id: userId,
      p_reason: "Off topic \nagain.",
    });
  });

  it("accepts wording past the 500 characters an audit reason allows", async () => {
    rpcReturns([{ warning_id: warningId }]);

    await expect(warnUser({ userId, reason: "y".repeat(900) })).resolves.toMatchObject({
      ok: true,
    });
  });

  it("rejects wording beyond the warning ceiling", async () => {
    const result = await warnUser({ userId, reason: "y".repeat(1001) });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "  ", "no"])("rejects wording of %s", async (reason) => {
    const result = await warnUser({ userId, reason });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a subject id that is not a uuid", async () => {
    const result = await warnUser({ userId: "someone", reason: "A real reason" });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("reports a self-warning or a protected target as the database classified it", async () => {
    rpcFails("22023");

    await expect(warnUser({ userId, reason: "A real reason" })).resolves.toMatchObject({
      ok: false,
      code: "invalid_request",
    });
  });

  it("retries rather than claiming success when the RPC returns no id", async () => {
    rpcReturns([]);

    await expect(warnUser({ userId, reason: "A real reason" })).resolves.toMatchObject({
      ok: false,
      code: "retry",
    });
  });

  it("refreshes the subject's Council page", async () => {
    rpcReturns([{ warning_id: warningId }]);

    await warnUser({ userId, reason: "A real reason" });

    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/council/users/${userId}`);
  });
});

describe("acknowledgeWarning", () => {
  it("sends nothing but the id, because nobody can acknowledge for someone else", async () => {
    rpcReturns(null);

    const result = await acknowledgeWarning(warningId);

    expect(result).toEqual({ ok: true, id: warningId });
    expect(mocks.rpc).toHaveBeenCalledWith("acknowledge_warning", { p_warning_id: warningId });
  });

  it("rejects an id that is not a uuid", async () => {
    const result = await acknowledgeWarning("latest");

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("reports someone else's warning as not found, matching the database", async () => {
    rpcFails("P0002");

    await expect(acknowledgeWarning(warningId)).resolves.toMatchObject({
      ok: false,
      code: "not_found",
    });
  });

  it("reports a second acknowledgement as an invalid request", async () => {
    rpcFails("22023");

    await expect(acknowledgeWarning(warningId)).resolves.toMatchObject({
      ok: false,
      code: "invalid_request",
    });
  });
});

describe("addUserNote", () => {
  it("normalises the body before calling the RPC", async () => {
    rpcReturns([{ note_id: noteId }]);

    const result = await addUserNote({ userId, body: "  Watching this one.  " });

    expect(result).toEqual({ ok: true, id: noteId });
    expect(mocks.rpc).toHaveBeenCalledWith("council_add_user_note", {
      p_user_id: userId,
      p_body: "Watching this one.",
    });
  });

  it("allows a note twice as long as a warning", async () => {
    rpcReturns([{ note_id: noteId }]);

    await expect(addUserNote({ userId, body: "z".repeat(2000) })).resolves.toMatchObject({
      ok: true,
    });
  });

  it("rejects a body beyond the note ceiling", async () => {
    const result = await addUserNote({ userId, body: "z".repeat(2001) });

    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("reports a caller without Council access as denied", async () => {
    rpcFails("42501");

    await expect(addUserNote({ userId, body: "Watching this one." })).resolves.toMatchObject({
      ok: false,
      code: "access_denied",
    });
  });
});

describe("deleteUserNote", () => {
  it("sends only the note id, since the database resolves the subject", async () => {
    rpcReturns(null);

    const result = await deleteUserNote(noteId, userId);

    expect(result).toEqual({ ok: true, id: noteId });
    expect(mocks.rpc).toHaveBeenCalledWith("council_delete_user_note", { p_note_id: noteId });
  });

  it("refreshes the subject's page when it was told which one", async () => {
    rpcReturns(null);

    await deleteUserNote(noteId, userId);

    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/council/users/${userId}`);
  });

  it("still removes the note when no subject was given", async () => {
    rpcReturns(null);

    await expect(deleteUserNote(noteId)).resolves.toEqual({ ok: true, id: noteId });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("reports another moderator's note as denied", async () => {
    rpcFails("42501");

    await expect(deleteUserNote(noteId, userId)).resolves.toMatchObject({
      ok: false,
      code: "access_denied",
    });
  });
});

describe("database failures", () => {
  it.each([
    ["42501", "access_denied"],
    ["P0002", "not_found"],
    ["22023", "invalid_request"],
    ["XX000", "retry"],
  ])("maps %s to %s", async (dbCode, actionCode) => {
    rpcFails(dbCode);

    await expect(warnUser({ userId, reason: "A real reason" })).resolves.toMatchObject({
      ok: false,
      code: actionCode,
    });
  });

  it("never leaks the database message to the caller", async () => {
    rpcFails("42501");

    const result = await warnUser({ userId, reason: "A real reason" });

    expect(JSON.stringify(result)).not.toContain("database said no");
  });

  it("does not refresh when the write failed", async () => {
    rpcFails("42501");

    await warnUser({ userId, reason: "A real reason" });

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("treats a thrown client failure as a retry rather than crashing the form", async () => {
    mocks.createClient.mockRejectedValue(new Error("no session"));

    await expect(warnUser({ userId, reason: "A real reason" })).resolves.toMatchObject({
      ok: false,
      code: "retry",
    });
  });

  it("keeps the write successful when cache revalidation throws", async () => {
    rpcReturns([{ warning_id: warningId }]);
    mocks.revalidatePath.mockImplementation(() => {
      throw new Error("static generation store missing");
    });

    await expect(warnUser({ userId, reason: "A real reason" })).resolves.toEqual({
      ok: true,
      id: warningId,
    });
  });
});
