import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AuditLogDto } from "./audit-log-dto";
import { AuditLogTable } from "./audit-log-table";

const auditLog: AuditLogDto = {
  action: "user.suspended",
  actionLabel: "Member suspended",
  actorDisplayName: "Council Steward",
  actorId: "10000000-0000-4000-8000-000000000001",
  createdAt: "2026-07-22T18:30:00.000Z",
  id: "20000000-0000-4000-8000-000000000001",
  newStatus: "suspended",
  oldStatus: "active",
  reason: "Repeated abuse after a documented warning",
  roleName: null,
  targetDisplayName: "Example Member",
  targetId: "30000000-0000-4000-8000-000000000001",
  targetType: "user",
  totalCount: 12,
};

describe("AuditLogTable", () => {
  it("renders a dense, responsive semantic table with stable UTC timestamps", () => {
    render(<AuditLogTable auditLogs={[auditLog]} hasFilters={false} total={12} />);

    const region = screen.getByRole("region", { name: "Council audit log" });
    const table = within(region).getByRole("table", {
      name: "Council audit events with actor, action, target, and details",
    });

    expect(region).toHaveClass("overflow-x-auto");
    expect(region).toHaveAttribute("tabindex", "0");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((heading) => heading.textContent),
    ).toEqual(["When", "Actor", "Action", "Target", "Details"]);
    expect(within(table).getByRole("columnheader", { name: "When" })).toHaveClass("py-2");
    expect(within(table).getByText("Jul 22, 2026, 6:30 PM UTC")).toHaveAttribute(
      "datetime",
      auditLog.createdAt,
    );
    expect(screen.getByText("12 audit events")).toHaveAttribute("aria-live", "polite");
  });

  it("keeps actor, target, reason, and role content escaped as plain text", () => {
    const hostileText = '<img src=x onerror="alert(1)">';
    render(
      <AuditLogTable
        auditLogs={[
          {
            ...auditLog,
            action: "user.role_assigned",
            actionLabel: "hostile label must not be trusted",
            actorDisplayName: hostileText,
            reason: hostileText,
            roleName: hostileText,
            targetDisplayName: hostileText,
          },
        ]}
        hasFilters={false}
        total={1}
      />,
    );

    expect(screen.getByText("Role assigned")).toBeVisible();
    expect(screen.queryByText("hostile label must not be trusted")).not.toBeInTheDocument();
    expect(screen.getAllByText(hostileText)).toHaveLength(3);
    expect(screen.getByText(`Assigned role: ${hostileText}`)).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("[onerror]")).toBeNull();
  });

  it("uses accessible disclosure details and does not expose identifiers", () => {
    render(<AuditLogTable auditLogs={[auditLog]} hasFilters={false} total={1} />);

    const disclosure = screen.getByText("View details");
    expect(disclosure.tagName).toBe("SUMMARY");
    expect(screen.getByText("Status changed from Active to Suspended")).toBeInTheDocument();
    expect(screen.getByText("Reason")).toBeInTheDocument();
    expect(screen.getByText(auditLog.reason!)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(auditLog.actorId);
    expect(document.body).not.toHaveTextContent(auditLog.targetId!);
  });

  it("uses a generic allowlisted label for unknown actions without leaking the raw key", () => {
    const unknownAction = "private.future_secret_action";
    render(
      <AuditLogTable
        auditLogs={[
          {
            ...auditLog,
            action: unknownAction,
            actionLabel: unknownAction,
            newStatus: null,
            oldStatus: null,
            reason: null,
          },
        ]}
        hasFilters={false}
        total={1}
      />,
    );

    expect(screen.getByText("Administrative action")).toBeVisible();
    expect(screen.getByText("No additional details")).toBeVisible();
    expect(document.body).not.toHaveTextContent(unknownAction);
    expect(screen.queryByText("View details")).not.toBeInTheDocument();
  });

  it("distinguishes an unused audit log from filtered results", () => {
    const { rerender } = render(<AuditLogTable auditLogs={[]} hasFilters={false} total={0} />);

    expect(screen.getByRole("heading", { name: "No audit events yet" })).toBeVisible();
    expect(screen.getByText("Administrative actions will appear here.")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Clear filters" })).not.toBeInTheDocument();

    rerender(<AuditLogTable auditLogs={[]} hasFilters total={0} />);

    expect(
      screen.getByRole("heading", { name: "No audit events match these filters" }),
    ).toBeVisible();
    expect(screen.getByText("Try adjusting or clearing the current filters.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/council/audit",
    );
  });
});
