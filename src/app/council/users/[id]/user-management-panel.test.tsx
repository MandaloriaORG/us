import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setUserStatus: vi.fn(),
  assignUserRole: vi.fn(),
  removeUserRole: vi.fn(),
}));

vi.mock("@/app/council/actions", () => ({
  setUserStatus: mocks.setUserStatus,
  assignUserRole: mocks.assignUserRole,
  removeUserRole: mocks.removeUserRole,
}));

import {
  UserManagementPanel,
  type CouncilRoleOption,
  type UserManagementPanelProps,
} from "./user-management-panel";

const targetUserId = "10000000-0000-4000-8000-000000000001";
const memberRole: CouncilRoleOption = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "Member",
  description: "Community member",
};
const curatorRole: CouncilRoleOption = {
  id: "20000000-0000-4000-8000-000000000002",
  name: "Community Curator",
};
const administratorRole: CouncilRoleOption = {
  id: "20000000-0000-4000-8000-000000000003",
  name: "Administrator",
  isProtected: true,
};
const guardianRole: CouncilRoleOption = {
  id: "20000000-0000-4000-8000-000000000004",
  name: "Guardian",
  isProtected: true,
};

const defaultProps: UserManagementPanelProps = {
  targetUserId,
  currentStatus: "active",
  assignedRoles: [memberRole],
  assignableRoles: [memberRole, curatorRole, administratorRole],
  canSuspend: true,
  canBan: true,
  canManageRoles: true,
  canManageProtectedRoles: false,
};

function renderPanel(overrides: Partial<UserManagementPanelProps> = {}) {
  return render(<UserManagementPanel {...defaultProps} {...overrides} />);
}

function enterReason(reason = "Approved after Council review") {
  fireEvent.change(screen.getByRole("textbox", { name: /Reason/ }), {
    target: { value: reason },
  });
}

function chooseStatus(status: "active" | "suspended" | "banned") {
  fireEvent.change(screen.getByRole("combobox", { name: "Change status" }), {
    target: { value: status },
  });
}

function chooseRole(roleId: string) {
  fireEvent.change(screen.getByRole("combobox", { name: "Assign role" }), {
    target: { value: roleId },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  const success = { ok: true, auditLogId: "30000000-0000-4000-8000-000000000001" };
  mocks.setUserStatus.mockResolvedValue(success);
  mocks.assignUserRole.mockResolvedValue(success);
  mocks.removeUserRole.mockResolvedValue(success);
});

describe("UserManagementPanel permissions and transition matrix", () => {
  it("renders nothing when the actor has no available management permission", () => {
    const { container } = renderPanel({
      canSuspend: false,
      canBan: false,
      canManageRoles: false,
    });

    expect(container).toBeEmptyDOMElement();
  });

  it("shows only status transitions allowed from the current state and by permission", () => {
    renderPanel({ canBan: false, canManageRoles: false });

    const select = screen.getByRole("combobox", { name: "Change status" });
    expect(select).toHaveTextContent("Suspend account");
    expect(select).not.toHaveTextContent("Ban account");
    expect(select).not.toHaveTextContent("Reactivate account");
    expect(screen.queryByRole("combobox", { name: "Assign role" })).not.toBeInTheDocument();
  });

  it("allows only unbanning from banned and only with ban permission", () => {
    renderPanel({
      currentStatus: "banned",
      canSuspend: true,
      canBan: true,
      canManageRoles: false,
    });

    const select = screen.getByRole("combobox", { name: "Change status" });
    expect(select).toHaveTextContent("Unban account");
    expect(select).not.toHaveTextContent("Suspend account");
    expect(select).not.toHaveTextContent("Ban account");
  });

  it("disables protected role changes without protected-role permission", () => {
    renderPanel({ assignedRoles: [administratorRole], assignableRoles: [guardianRole] });

    expect(screen.getByRole("option", { name: "Guardian (protected)" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove Administrator role" })).toBeDisabled();
    expect(screen.getByText("Protected")).toBeInTheDocument();
  });
});

describe("UserManagementPanel validation and confirmations", () => {
  it.each([" x ", "x".repeat(501)])(
    "rejects a reason outside the 3–500 character contract",
    (reason) => {
      renderPanel();
      enterReason(reason);
      chooseStatus("suspended");
      fireEvent.click(screen.getByRole("button", { name: "Review status change" }));

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Enter a reason between 3 and 500 characters.",
      );
      expect(screen.queryByRole("group", { name: "Confirm change" })).not.toBeInTheDocument();
      expect(mocks.setUserStatus).not.toHaveBeenCalled();
    },
  );

  it("requires inline confirmation before suspending and sends trimmed audited arguments", async () => {
    renderPanel();
    enterReason("  Repeated harassment after warning  ");
    chooseStatus("suspended");
    fireEvent.click(screen.getByRole("button", { name: "Review status change" }));

    expect(mocks.setUserStatus).not.toHaveBeenCalled();
    expect(
      screen.getByText(/They will lose access until the account is reactivated/),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Confirm change" }));

    await waitFor(() =>
      expect(mocks.setUserStatus).toHaveBeenCalledWith({
        targetUserId,
        expectedStatus: "active",
        status: "suspended",
        reason: "Repeated harassment after warning",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Account status updated.");
    expect(screen.getByRole("combobox", { name: "Change status" })).toHaveTextContent(
      "Reactivate account",
    );
  });

  it("requires inline confirmation before role removal and sends the selected role", async () => {
    renderPanel();
    enterReason("Role is no longer required");
    fireEvent.click(screen.getByRole("button", { name: "Remove Member role" }));

    expect(mocks.removeUserRole).not.toHaveBeenCalled();
    expect(screen.getByText("Remove the Member role from this member?")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Confirm change" }));

    await waitFor(() =>
      expect(mocks.removeUserRole).toHaveBeenCalledWith({
        targetUserId,
        roleId: memberRole.id,
        reason: "Role is no longer required",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Member role removed.");
    expect(screen.queryByRole("button", { name: "Remove Member role" })).not.toBeInTheDocument();
  });

  it("assigns an allowed role without a destructive confirmation", async () => {
    renderPanel();
    enterReason("Approved by the Council");
    chooseRole(curatorRole.id);
    fireEvent.click(screen.getByRole("button", { name: "Assign role" }));

    await waitFor(() =>
      expect(mocks.assignUserRole).toHaveBeenCalledWith({
        targetUserId,
        roleId: curatorRole.id,
        reason: "Approved by the Council",
      }),
    );
    expect(screen.queryByRole("group", { name: "Confirm change" })).not.toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent("Community Curator role assigned.");
    expect(screen.getByRole("button", { name: "Remove Community Curator role" })).toBeEnabled();
  });

  it("requires confirmation before assigning a protected role", async () => {
    renderPanel({ canManageProtectedRoles: true });
    enterReason("Administrator access approved");
    chooseRole(administratorRole.id);
    fireEvent.click(screen.getByRole("button", { name: "Assign role" }));

    const confirmation = screen.getByRole("group", { name: "Confirm change" });
    expect(confirmation).toHaveFocus();
    expect(confirmation).toHaveTextContent(
      "Assign the protected Administrator role to this member?",
    );
    expect(mocks.assignUserRole).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm change" }));

    await waitFor(() =>
      expect(mocks.assignUserRole).toHaveBeenCalledWith({
        targetUserId,
        roleId: administratorRole.id,
        reason: "Administrator access approved",
      }),
    );
  });

  it("returns focus to the invoking control when confirmation is cancelled", async () => {
    renderPanel();
    enterReason();
    chooseStatus("suspended");
    const reviewButton = screen.getByRole("button", { name: "Review status change" });
    fireEvent.click(reviewButton);

    expect(screen.getByRole("group", { name: "Confirm change" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(reviewButton).toHaveFocus());
  });
});

describe("UserManagementPanel pending and feedback states", () => {
  it("blocks duplicate submissions while the local mutation is pending", async () => {
    let resolveMutation: ((value: { ok: true; auditLogId: string }) => void) | undefined;
    mocks.setUserStatus.mockReturnValue(
      new Promise((resolve) => {
        resolveMutation = resolve;
      }),
    );
    renderPanel({
      currentStatus: "suspended",
      canBan: false,
      canManageRoles: false,
    });
    enterReason();
    chooseStatus("active");

    const submit = screen.getByRole("button", { name: "Review status change" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(mocks.setUserStatus).toHaveBeenCalledTimes(1);
    expect(mocks.setUserStatus).toHaveBeenCalledWith({
      targetUserId,
      expectedStatus: "suspended",
      status: "active",
      reason: "Approved after Council review",
    });
    expect(submit).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /Reason/ })).toBeDisabled();

    resolveMutation?.({
      ok: true,
      auditLogId: "30000000-0000-4000-8000-000000000001",
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Account status updated.");
  });

  it.each([
    {
      name: "status",
      message: "Status change denied.",
      arrange: () => {
        chooseStatus("active");
        fireEvent.click(screen.getByRole("button", { name: "Review status change" }));
      },
      mock: () => mocks.setUserStatus,
      props: { currentStatus: "suspended", canBan: false, canManageRoles: false },
    },
    {
      name: "role assignment",
      message: "Role assignment denied.",
      arrange: () => {
        chooseRole(curatorRole.id);
        fireEvent.click(screen.getByRole("button", { name: "Assign role" }));
      },
      mock: () => mocks.assignUserRole,
      props: { canSuspend: false, canBan: false },
    },
    {
      name: "role removal",
      message: "Role removal denied.",
      arrange: () => {
        fireEvent.click(screen.getByRole("button", { name: "Remove Member role" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirm change" }));
      },
      mock: () => mocks.removeUserRole,
      props: { canSuspend: false, canBan: false },
    },
  ])("announces a safe $name failure locally", async ({ arrange, message, mock, props }) => {
    mock().mockResolvedValueOnce({ ok: false, code: "access_denied", message });
    renderPanel(props as Partial<UserManagementPanelProps>);
    enterReason();
    arrange();

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
