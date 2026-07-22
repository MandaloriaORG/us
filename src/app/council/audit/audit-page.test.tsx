import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  getCouncilAuditAccess: vi.fn(),
  redirect: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/app/council/access", () => ({
  getCouncilAuditAccess: mocks.getCouncilAuditAccess,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

import CouncilAuditPage, { dynamic } from "./page";

interface RpcResult {
  data: unknown;
  error: { message: string } | null;
}

interface RpcOperation {
  args: Record<string, unknown>;
  name: string;
}

const actorId = "123e4567-e89b-42d3-a456-426614174000";
const targetId = "20000000-0000-4000-8000-000000000002";
const rpcOperations: RpcOperation[] = [];
const rpcResults: RpcResult[] = [];

function ok(data: unknown): RpcResult {
  return { data, error: null };
}

function failed(message: string): RpcResult {
  return { data: null, error: { message } };
}

function auditRow(totalCount = 1, overrides: Record<string, unknown> = {}) {
  return {
    action: "user.suspended",
    actor_display_name: "Council Steward",
    actor_id: actorId,
    created_at: "2026-07-22T18:30:00.000Z",
    id: "30000000-0000-4000-8000-000000000003",
    new_status: "suspended",
    old_status: "active",
    reason: "Repeated abuse after a documented warning",
    role_name: null,
    target_display_name: "Example Member",
    target_id: targetId,
    target_type: "user",
    total_count: totalCount,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  rpcOperations.length = 0;
  rpcResults.length = 0;

  mocks.getCouncilAuditAccess.mockResolvedValue({ allowed: true, userId: actorId });
  mocks.redirect.mockImplementation((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  });
  mocks.rpc.mockImplementation((name: string, args: Record<string, unknown>) => {
    rpcOperations.push({ args, name });
    return Promise.resolve(rpcResults.shift() ?? ok([]));
  });
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});

describe("Council audit page", () => {
  it("stays request-bound and authorizes before creating an authenticated client", async () => {
    expect(dynamic).toBe("force-dynamic");
    mocks.getCouncilAuditAccess.mockResolvedValue({
      allowed: false,
      reason: "missing_permission",
    });

    await expect(CouncilAuditPage({ searchParams: {} })).resolves.toBeNull();

    expect(mocks.getCouncilAuditAccess).toHaveBeenCalledOnce();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("surfaces only a generic authorization verification failure", async () => {
    mocks.getCouncilAuditAccess.mockResolvedValue({
      allowed: false,
      reason: "verification_failed",
    });

    await expect(CouncilAuditPage({ searchParams: {} })).rejects.toThrow(
      "Council audit authorization could not be verified",
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("preserves invalid filters, shows field errors, and never queries", async () => {
    const searchParams = {
      action: "private.secret_action",
      actor: "not-an-actor",
      from: "2025-02-29",
      page: "0",
      target: "not-a-target",
      to: "tomorrow",
    };

    const element = await CouncilAuditPage({ searchParams });
    render(element);

    expect(screen.getByRole("heading", { name: "Check the audit filters" })).toBeVisible();
    expect(screen.getByLabelText("Action")).toHaveValue(searchParams.action);
    expect(screen.getByLabelText("Actor ID")).toHaveValue(searchParams.actor);
    expect(screen.getByLabelText("Target ID")).toHaveValue(searchParams.target);
    expect(screen.getByLabelText("From")).toHaveValue(searchParams.from);
    expect(screen.getByLabelText("To")).toHaveValue(searchParams.to);
    expect(screen.getByText("Choose a supported audit action.")).toBeVisible();
    expect(screen.getByText("Enter a valid actor ID.")).toBeVisible();
    expect(screen.getByText("Enter a valid target ID.")).toBeVisible();
    expect(screen.getAllByText("Enter a real date in YYYY-MM-DD format.")).toHaveLength(2);
    expect(screen.getByText(/Page: Enter a whole page number/)).toBeVisible();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("calls the exact authenticated RPC with normalized URL-backed filters", async () => {
    rpcResults.push(ok([auditRow(1)]));

    const element = await CouncilAuditPage({
      searchParams: {
        action: "user.suspended",
        actor: actorId.toUpperCase(),
        from: "2026-07-01",
        target: targetId,
        to: "2026-07-22",
      },
    });
    render(element);

    expect(mocks.createClient).toHaveBeenCalledOnce();
    expect(rpcOperations).toEqual([
      {
        name: "council_list_audit_logs",
        args: {
          p_action: "user.suspended",
          p_actor_id: actorId,
          p_created_before: "2026-07-23T00:00:00.000Z",
          p_created_from: "2026-07-01T00:00:00.000Z",
          p_limit: 50,
          p_offset: 0,
          p_target_id: targetId,
        },
      },
    ]);
    expect(screen.getByRole("heading", { name: "Audit logs" })).toBeVisible();
    expect(screen.getByText("Council Steward")).toBeVisible();
    expect(screen.getByText("1 audit event")).toBeVisible();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/council/audit",
    );
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("drops untrusted row fields instead of forwarding raw audit JSON", async () => {
    rpcResults.push(
      ok([
        auditRow(1, {
          metadata: "private metadata",
          new_values: "private new JSON",
          old_values: "private old JSON",
        }),
      ]),
    );

    const element = await CouncilAuditPage({ searchParams: {} });
    render(element);

    expect(document.body).not.toHaveTextContent("private metadata");
    expect(document.body).not.toHaveTextContent("private new JSON");
    expect(document.body).not.toHaveTextContent("private old JSON");
    expect(screen.getByText("Example Member")).toBeVisible();
  });

  it("throws a generic load error without exposing the RPC failure", async () => {
    rpcResults.push(failed("secret database diagnostic"));

    const request = CouncilAuditPage({ searchParams: {} });

    await expect(request).rejects.toThrow("Council audit logs could not be loaded");
    await expect(request).rejects.not.toThrow("secret database diagnostic");
  });

  it("probes an empty out-of-range page with identical filters and redirects canonically", async () => {
    rpcResults.push(ok([]), ok([auditRow(51)]));

    await expect(
      CouncilAuditPage({
        searchParams: {
          action: "user.banned",
          actor: actorId,
          page: "3",
        },
      }),
    ).rejects.toThrow(`NEXT_REDIRECT:/council/audit?action=user.banned&actor=${actorId}&page=2`);

    expect(rpcOperations).toEqual([
      {
        name: "council_list_audit_logs",
        args: expect.objectContaining({
          p_action: "user.banned",
          p_actor_id: actorId,
          p_limit: 50,
          p_offset: 100,
        }),
      },
      {
        name: "council_list_audit_logs",
        args: expect.objectContaining({
          p_action: "user.banned",
          p_actor_id: actorId,
          p_limit: 1,
          p_offset: 0,
        }),
      },
    ]);
    expect(rpcOperations[1].args).toEqual({
      ...rpcOperations[0].args,
      p_limit: 1,
      p_offset: 0,
    });
  });

  it("removes page from the canonical redirect when filtered results are empty", async () => {
    rpcResults.push(ok([]), ok([]));

    await expect(
      CouncilAuditPage({ searchParams: { page: "2", target: targetId } }),
    ).rejects.toThrow(`NEXT_REDIRECT:/council/audit?target=${targetId}`);
  });

  it("fails closed when the empty-page probe fails", async () => {
    rpcResults.push(ok([]), failed("probe diagnostic"));

    await expect(CouncilAuditPage({ searchParams: { page: "2" } })).rejects.toThrow(
      "Council audit logs could not be loaded",
    );
  });

  it("builds previous and next links from the canonical filter query", async () => {
    rpcResults.push(
      ok([
        auditRow(101, {
          action: "user.role_removed",
          new_status: null,
          old_status: null,
          role_name: "Community Curator",
        }),
      ]),
    );

    const element = await CouncilAuditPage({
      searchParams: { action: "user.role_removed", page: "2" },
    });
    render(element);

    expect(screen.getByText("Page 2 of 3")).toBeVisible();
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/council/audit?action=user.role_removed",
    );
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/council/audit?action=user.role_removed&page=3",
    );
  });

  it("caps pagination at the maximum offset supported by the RPC", async () => {
    rpcResults.push(ok([auditRow(2_000_000)]));

    const element = await CouncilAuditPage({ searchParams: { page: "20001" } });
    render(element);

    expect(screen.getByText("Page 20001 of 20001")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Next" })).toBeNull();
  });

  it("renders distinct unfiltered and filtered empty states without pagination", async () => {
    rpcResults.push(ok([]));
    const unfiltered = await CouncilAuditPage({ searchParams: {} });
    const { unmount } = render(unfiltered);

    expect(screen.getByRole("heading", { name: "No audit events yet" })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Audit log pagination" })).toBeNull();
    unmount();

    rpcResults.push(ok([]));
    const filtered = await CouncilAuditPage({ searchParams: { action: "user.unbanned" } });
    render(filtered);

    expect(
      screen.getByRole("heading", { name: "No audit events match these filters" }),
    ).toBeVisible();
  });
});
