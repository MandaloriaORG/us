import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProfileById: vi.fn(),
  listMemberProfiles: vi.fn(),
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/actions/profile", () => ({
  getProfileById: mocks.getProfileById,
  listMemberProfiles: mocks.listMemberProfiles,
}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));

import MemberProfilePage from "@/app/members/[id]/page";
import MembersError from "@/app/members/error";
import MembersLoading from "@/app/members/loading";
import MembersPage from "@/app/members/page";
import { safeExternalUrl } from "@/app/members/safe-external-url";

const memberId = "00000000-0000-4000-8000-000000000001";

function publicProfile(overrides: Record<string, unknown> = {}) {
  return {
    status: "ok" as const,
    profile: {
      id: memberId,
      display_name: "Din Djarin",
      avatar_path: null,
      avatarUrl: null,
      bio: "Bounty hunter",
      website: "https://example.com/path",
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
      roles: ["Member"],
      ...overrides,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listMemberProfiles.mockResolvedValue({
    status: "ok",
    profiles: [],
    totalCount: 0,
    page: 1,
    pageSize: 25,
    search: "",
  });
  mocks.getProfileById.mockResolvedValue(publicProfile());
  mocks.notFound.mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
  mocks.redirect.mockImplementation((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  });
});

describe("member directory", () => {
  it("provides an announced loading state", () => {
    render(<MembersLoading />);

    expect(screen.getByLabelText("Loading members")).toHaveAttribute("aria-busy", "true");
  });

  it("recovers from unexpected route errors without logging their message", () => {
    const reset = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <MembersError
        error={Object.assign(new Error("sensitive detail"), { digest: "members-123" })}
        reset={reset}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith("Member content failed to load.", {
      digest: "members-123",
    });
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining("sensitive detail"));
    consoleError.mockRestore();
  });

  it("renders an explicit empty state from a successful empty result", async () => {
    render(await MembersPage({}));

    expect(screen.getByRole("heading", { name: "No members yet" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("distinguishes a query error from an empty directory", async () => {
    mocks.listMemberProfiles.mockResolvedValue({ status: "error" });

    render(await MembersPage({}));

    expect(screen.getByRole("alert")).toHaveTextContent("temporarily unavailable");
    expect(screen.queryByText("database detail")).toBeNull();
  });

  it("renders bounded profile links with browser-side avatar fallbacks", async () => {
    mocks.listMemberProfiles.mockResolvedValue({
      status: "ok",
      profiles: [
        {
          id: memberId,
          display_name: "Din Djarin",
          avatar_path: `${memberId}/00000000-0000-4000-8000-000000000002.webp`,
          avatarUrl: "file:///etc/passwd",
          bio: "Bounty hunter",
          website: null,
          created_at: "2025-01-01T00:00:00.000Z",
          role_names: ["Member"],
          roles: ["Member"],
          total_count: 1,
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 25,
      search: "",
    });

    render(await MembersPage({}));

    expect(screen.getByRole("link", { name: /Din Djarin/ })).toHaveAttribute(
      "href",
      `/members/${memberId}`,
    );
    expect(document.querySelector('img[src="file:///etc/passwd"]')).toBeNull();
    expect(mocks.listMemberProfiles).toHaveBeenCalledWith({ search: "", page: 1 });
  });

  it("renders URL-backed search and pagination", async () => {
    mocks.listMemberProfiles.mockResolvedValue({
      status: "ok",
      profiles: [
        {
          id: memberId,
          display_name: "Din Djarin",
          avatar_path: null,
          avatarUrl: null,
          bio: null,
          website: null,
          created_at: "2025-01-01T00:00:00.000Z",
          role_names: [],
          roles: [],
          total_count: 60,
        },
      ],
      totalCount: 60,
      page: 2,
      pageSize: 25,
      search: "Din",
    });

    render(await MembersPage({ searchParams: { q: " Din ", page: "2" } }));

    expect(screen.getByLabelText("Search members")).toHaveValue("Din");
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/members?q=Din",
    );
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/members?q=Din&page=3",
    );
  });

  it("redirects an empty out-of-range page to the first bounded page", async () => {
    mocks.listMemberProfiles.mockResolvedValue({
      status: "ok",
      profiles: [],
      totalCount: 0,
      page: 9,
      pageSize: 25,
      search: "Din",
    });

    await expect(MembersPage({ searchParams: { q: "Din", page: "9" } })).rejects.toThrow(
      "NEXT_REDIRECT:/members?q=Din",
    );
  });
});

describe("member profile", () => {
  it("uses a safe external website and a labelled avatar", async () => {
    render(await MemberProfilePage({ params: { id: memberId } }));

    expect(screen.getByRole("img", { name: "Din Djarin's avatar" })).toBeInTheDocument();
    const website = screen.getByRole("link", { name: "example.com" });
    expect(website).toHaveAttribute("href", "https://example.com/path");
    expect(website).toHaveClass("min-h-11", "focus-visible:ring-2");
    expect(screen.getByRole("link", { name: "All members" })).toHaveClass(
      "min-h-11",
      "focus-visible:ring-2",
    );
  });

  it.each(["javascript:alert(1)", "https://user:secret@example.com", "not a URL"])(
    "does not render unsafe stored website %s",
    async (website) => {
      mocks.getProfileById.mockResolvedValue(publicProfile({ website }));

      render(await MemberProfilePage({ params: { id: memberId } }));
      expect(screen.queryByRole("link", { name: /example|javascript|not a URL/i })).toBeNull();
    },
  );

  it("renders long multiline content without discarding line breaks", async () => {
    mocks.getProfileById.mockResolvedValue(
      publicProfile({ display_name: "A".repeat(50), bio: "Line one\nLine two" }),
    );

    render(await MemberProfilePage({ params: { id: memberId } }));
    expect(screen.getByRole("heading", { name: "A".repeat(50) })).toHaveClass("break-words");
    expect(screen.getByText(/Line one/)).toHaveClass("whitespace-pre-wrap", "break-words");
  });

  it("renders a recoverable profile error", async () => {
    mocks.getProfileById.mockResolvedValue({ status: "error" });

    render(await MemberProfilePage({ params: { id: memberId } }));
    expect(screen.getByRole("alert")).toHaveTextContent("temporarily unavailable");
  });

  it("uses the not-found boundary for invisible or missing profiles", async () => {
    mocks.getProfileById.mockResolvedValue({ status: "not_found" });

    await expect(MemberProfilePage({ params: { id: memberId } })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("safeExternalUrl", () => {
  it("accepts only bounded http and https URLs without credentials", () => {
    expect(safeExternalUrl("http://example.com/path")).toEqual({
      href: "http://example.com/path",
      label: "example.com",
    });
    expect(safeExternalUrl("ftp://example.com")).toBeNull();
    expect(safeExternalUrl("https://user:secret@example.com")).toBeNull();
    expect(safeExternalUrl(`https://example.com/${"a".repeat(2048)}`)).toBeNull();
  });
});
