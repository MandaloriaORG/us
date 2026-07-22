import { render, screen } from "@testing-library/react";
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
vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return { ...actual, useFormStatus: () => ({ pending: mocks.pending }) };
});

import { NavAuth } from "@/app/NavAuth";
import { dynamic } from "@/app/layout";

beforeEach(() => {
  mocks.pending = false;
});

describe("identity navigation", () => {
  it("keeps the auth-aware root layout request-bound", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("renders a full-height sign-in target for visitors", () => {
    render(<NavAuth user={null} profile={null} />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveClass(
      "h-11",
      "focus-visible:ring-2",
    );
  });

  it("renders labelled 44px profile and sign-out targets", () => {
    render(
      <NavAuth
        user={{ id: "00000000-0000-4000-8000-000000000001" }}
        profile={{ display_name: "Din Djarin", avatar_url: null }}
      />,
    );

    expect(screen.getByRole("link", { name: "Edit profile" })).toHaveClass(
      "min-h-11",
      "focus-visible:ring-2",
    );
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveClass(
      "h-11",
      "w-11",
      "focus-visible:ring-2",
    );
  });

  it("does not send an unsafe stored avatar through an image loader", () => {
    render(
      <NavAuth
        user={{ id: "00000000-0000-4000-8000-000000000001" }}
        profile={{ display_name: "Din Djarin", avatar_url: "file:///etc/passwd" }}
      />,
    );

    expect(document.querySelector('img[src="file:///etc/passwd"]')).toBeNull();
    expect(screen.getByRole("link", { name: "Edit profile" })).toBeInTheDocument();
  });

  it("disables repeat submissions while logout is pending", () => {
    mocks.pending = true;

    render(
      <NavAuth
        user={{ id: "00000000-0000-4000-8000-000000000001" }}
        profile={{ display_name: "Din Djarin", avatar_url: null }}
      />,
    );

    const button = screen.getByRole("button", { name: "Signing out" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});
