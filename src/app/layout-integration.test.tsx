import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canAny: vi.fn(),
  createClient: vi.fn(),
  createSignedUrl: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  single: vi.fn(),
}));

vi.mock("next/font/google", () => ({
  Cinzel: () => ({ variable: "font-display" }),
  Inter: () => ({ variable: "font-sans" }),
  JetBrains_Mono: () => ({ variable: "font-mono" }),
}));
vi.mock("@/components/layout/mobile-nav", () => ({
  MobileNav: ({ items }: { items: Array<{ href: string; label: string }> }) => (
    <ul aria-label="Mobile navigation items">
      {items.map((item) => (
        <li key={item.href}>{item.label}</li>
      ))}
    </ul>
  ),
}));
vi.mock("@/lib/permissions", () => ({ canAny: mocks.canAny }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/app/NavAuth", () => ({
  NavAuth: ({
    user,
    profile,
  }: {
    user: { id: string } | null;
    profile: { avatar_url: string | null } | null;
  }) => (
    <span data-avatar={profile?.avatar_url ?? undefined}>
      {user ? "Signed in navigation" : "Signed out navigation"}
    </span>
  ),
}));

import RootLayout, { dynamic } from "@/app/layout";

function profileQuery() {
  const query = { eq: vi.fn(), select: vi.fn(), single: mocks.single };
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  return query;
}

async function renderLayout() {
  const layout = await RootLayout({ children: <main>Page content</main> });
  const body = layout.props.children;
  return render(<>{body.props.children}</>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mocks.single.mockResolvedValue({
    data: {
      display_name: "Din Djarin",
      avatar_path: "00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.webp",
    },
    error: null,
  });
  mocks.createSignedUrl.mockResolvedValue({
    data: { signedUrl: "https://storage.test/avatar.webp?token=test" },
    error: null,
  });
  mocks.canAny.mockResolvedValue({ allowed: false, reason: "missing_permission" });
  mocks.from.mockReturnValue(profileQuery());
  mocks.createClient.mockResolvedValue({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
    storage: { from: () => ({ createSignedUrl: mocks.createSignedUrl }) },
  });
});

describe("root layout identity integration", () => {
  it("is request-bound and provides keyboard bypass navigation", async () => {
    expect(dynamic).toBe("force-dynamic");

    const { container } = await renderLayout();
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    expect(container.querySelector("#main-content")).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
  });

  it("moves every public destination into the mobile menu", async () => {
    await renderLayout();

    const mobileItems = within(screen.getByLabelText("Mobile navigation items"));
    expect(mobileItems.getByText("Plazas")).toBeInTheDocument();
    expect(mobileItems.getByText("Codex Libre")).toBeInTheDocument();
    expect(mobileItems.getByText("Members")).toBeInTheDocument();
    expect(mobileItems.queryByText("Council")).toBeNull();
  });

  it("adds Council to mobile and inline navigation for an authorized actor", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "00000000-0000-4000-8000-000000000001" } },
      error: null,
    });
    mocks.canAny.mockResolvedValue({ allowed: true });

    await renderLayout();

    expect(
      within(screen.getByLabelText("Mobile navigation items")).getByText("Council"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Council" })).toHaveClass("sm:inline-flex");
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.webp",
      300,
    );
    expect(screen.getByText("Signed in navigation")).toHaveAttribute(
      "data-avatar",
      "https://storage.test/avatar.webp?token=test",
    );
    expect(mocks.canAny).toHaveBeenCalledWith(["admin.view_users", "admin.view_audit_logs"]);
  });

  it("shows Council for an audit-only actor", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "00000000-0000-4000-8000-000000000001" } },
      error: null,
    });
    mocks.canAny.mockImplementation(async (permissions: string[]) => ({
      allowed: permissions.includes("admin.view_audit_logs"),
    }));

    await renderLayout();

    expect(
      within(screen.getByLabelText("Mobile navigation items")).getByText("Council"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Council" })).toBeInTheDocument();
  });
});
