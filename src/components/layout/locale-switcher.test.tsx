"use client";

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useLocale: vi.fn().mockReturnValue("en"),
  refresh: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useLocale: () => mocks.useLocale(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import { LocaleSwitcher } from "./locale-switcher";

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value};path=/`;
}

describe("LocaleSwitcher", () => {
  beforeEach(() => {
    mocks.refresh.mockClear();
    mocks.useLocale.mockReturnValue("en");
    // jsdom: reset cookie store
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0].trim();
      if (name) document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
  });

  it("renders both locales and marks the active one pressed", () => {
    render(<LocaleSwitcher />);
    expect(screen.getByRole("button", { name: "en" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "es" })).toHaveAttribute("aria-pressed", "false");
  });

  it("writes the NEXT_LOCALE cookie and refreshes when switching", () => {
    render(<LocaleSwitcher />);
    setCookie("NEXT_LOCALE", "en");
    fireEvent.click(screen.getByRole("button", { name: "es" }));
    expect(document.cookie).toContain("NEXT_LOCALE=es");
    expect(mocks.refresh).toHaveBeenCalled();
  });
});