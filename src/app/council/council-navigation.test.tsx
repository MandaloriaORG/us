import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: "/council/users" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

import { CouncilNavigation } from "./council-navigation";

beforeEach(() => {
  mocks.pathname = "/council/users";
});

describe("CouncilNavigation", () => {
  it("shows only destinations allowed by the resolved permissions", () => {
    const { rerender } = render(<CouncilNavigation canViewAudit={false} canViewUsers />);

    expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute("href", "/council/users");
    expect(screen.queryByRole("link", { name: "Audit logs" })).not.toBeInTheDocument();

    rerender(<CouncilNavigation canViewAudit canViewUsers={false} />);

    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Audit logs" })).toHaveAttribute(
      "href",
      "/council/audit",
    );
  });

  it("renders no empty navigation landmark when neither destination is allowed", () => {
    render(<CouncilNavigation canViewAudit={false} canViewUsers={false} />);

    expect(
      screen.queryByRole("navigation", { name: "Council navigation" }),
    ).not.toBeInTheDocument();
  });

  it("marks exact and nested routes by segment with a single aria-current", () => {
    const { container, rerender } = render(<CouncilNavigation canViewAudit canViewUsers />);
    const users = screen.getByRole("link", { name: "Users" });
    const audit = screen.getByRole("link", { name: "Audit logs" });

    expect(users).toHaveAttribute("aria-current", "page");
    expect(audit).not.toHaveAttribute("aria-current");
    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(1);

    mocks.pathname = "/council/audit/0195f3a0";
    rerender(<CouncilNavigation canViewAudit canViewUsers />);

    expect(users).not.toHaveAttribute("aria-current");
    expect(audit).toHaveAttribute("aria-current", "page");
    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(1);

    mocks.pathname = "/council/users-archive";
    rerender(<CouncilNavigation canViewAudit canViewUsers />);

    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(0);
  });

  it("provides 44px link targets in horizontal and vertical layouts", () => {
    const { rerender } = render(
      <CouncilNavigation canViewAudit canViewUsers className="test-class" variant="horizontal" />,
    );

    expect(screen.getByRole("navigation", { name: "Council navigation" })).toHaveClass(
      "flex",
      "items-center",
      "test-class",
    );
    expect(screen.getAllByRole("link")).toHaveLength(2);
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveClass("h-11", "focus-visible:ring-2");
    }

    rerender(<CouncilNavigation canViewAudit canViewUsers variant="vertical" />);

    expect(screen.getByRole("navigation", { name: "Council navigation" })).toHaveClass("flex-col");
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveClass("h-11", "w-full");
    }
  });
});
