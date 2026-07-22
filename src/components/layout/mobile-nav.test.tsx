import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: "/plazas" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

import { MobileNav } from "./mobile-nav";

const items = [
  { href: "/plazas", label: "Plazas" },
  { href: "/codex", label: "Codex Libre" },
] as const;

beforeEach(() => {
  mocks.pathname = "/plazas";
});

describe("MobileNav", () => {
  it("renders an accessible 44px menu trigger", () => {
    render(<MobileNav className="sm:hidden" items={items} triggerLabel="Open main navigation" />);

    const trigger = screen.getByRole("button", { name: "Open main navigation" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveClass("h-11", "w-11", "sm:hidden");
  });

  it("opens every destination and marks only the current route", () => {
    render(<MobileNav items={items} />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Open navigation" }), {
      button: 0,
      ctrlKey: false,
    });

    const plazas = screen.getByRole("menuitem", { name: "Plazas" });
    const codex = screen.getByRole("menuitem", { name: "Codex Libre" });

    expect(plazas).toHaveAttribute("href", "/plazas");
    expect(plazas).toHaveAttribute("aria-current", "page");
    expect(codex).toHaveAttribute("href", "/codex");
    expect(codex).not.toHaveAttribute("aria-current");
  });
});
