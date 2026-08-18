import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pending: false }));

vi.mock("next/font/google", () => ({
  Cinzel: () => ({ variable: "font-display" }),
  Inter: () => ({ variable: "font-sans" }),
  JetBrains_Mono: () => ({ variable: "font-mono" }),
}));
vi.mock("@/lib/actions/auth", () => ({ logout: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ canAny: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/components/layout/locale-switcher", () => ({
  LocaleSwitcher: () => <span data-testid="locale-switcher" />,
}));
vi.mock("@/components/system/notification-bell", () => ({
  NotificationBell: () => <span data-testid="notification-bell" />,
}));
vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return { ...actual, useFormStatus: () => ({ pending: mocks.pending }) };
});

import { NavAuth } from "@/app/NavAuth";
import { dynamic } from "@/app/layout";

beforeEach(() => {
  mocks.pending = false;
});

function renderSignedIn(avatarUrl: string | null = null) {
  render(
    <NavAuth
      user={{ id: "00000000-0000-4000-8000-000000000001" }}
      profile={{ display_name: "Din Djarin", avatar_url: avatarUrl }}
    />,
  );
  return screen.getByRole("button", { name: "Open user menu" });
}

describe("identity navigation", () => {
  it("keeps the auth-aware root layout request-bound", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("renders a search target and a full-height sign-in target for visitors", () => {
    render(<NavAuth user={null} profile={null} />);

    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/search");
    expect(screen.getByRole("link", { name: "Search" })).toHaveClass(
      "h-11",
      "w-11",
      "focus-visible:ring-2",
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveClass(
      "h-11",
      "focus-visible:ring-2",
    );
    expect(screen.queryByTestId("notification-bell")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open user menu" })).not.toBeInTheDocument();
  });

  it("collapses profile, settings and sign-out behind the avatar menu", async () => {
    renderSignedIn();

    expect(screen.getByTestId("notification-bell")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/search");

    // The header is clean: no gear or logout float next to the avatar.
    expect(screen.queryByRole("link", { name: "Account settings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();

    // The avatar trigger is a full-height labelled control.
    const trigger = screen.getByRole("button", { name: "Open user menu" });
    expect(trigger).toHaveClass("min-h-11", "focus-visible:ring-2");
    expect(trigger).toHaveTextContent("Din Djarin");

    // Opening the menu exposes profile, settings and sign-out.
    fireEvent.pointerDown(trigger, { button: 0 });
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Edit profile" })).toHaveAttribute(
      "href",
      "/profile/edit",
    );
    expect(within(menu).getByRole("menuitem", { name: "Account settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
    expect(within(menu).getByTestId("locale-switcher")).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("does not send an unsafe stored avatar through an image loader", async () => {
    const trigger = renderSignedIn("file:///etc/passwd");

    expect(document.querySelector('img[src="file:///etc/passwd"]')).toBeNull();
    expect(trigger).toBeInTheDocument();

    fireEvent.pointerDown(trigger, { button: 0 });
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Edit profile" })).toBeInTheDocument();
  });

  it("disables repeat submissions while logout is pending", async () => {
    mocks.pending = true;

    const trigger = renderSignedIn();
    fireEvent.pointerDown(trigger, { button: 0 });
    const menu = await screen.findByRole("menu");

    const button = within(menu).getByRole("button", { name: "Signing out" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});
