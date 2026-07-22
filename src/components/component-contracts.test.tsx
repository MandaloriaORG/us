import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NativeSelect } from "@/components/origin/native-select";
import { PasswordInput } from "@/components/origin/password-input";
import { SearchInput } from "@/components/origin/search-input";
import { StatusBadge } from "@/components/origin/status-badge";
import { TextInput } from "@/components/origin/text-input";
import { Avatar, safeAvatarUrl } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

describe("shared component contracts", () => {
  it("links Origin text input help and validation to its visible label", () => {
    render(
      <TextInput
        description="Shown to other members."
        error="Choose a display name."
        id="display-name"
        label="Display name"
        required
      />,
    );

    const input = screen.getByLabelText(/Display name/);
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Shown to other members. Choose a display name.");
  });

  it("gives the password reveal control a state-dependent accessible name", () => {
    render(<PasswordInput id="password" label="Password" />);

    const input = screen.getByLabelText("Password");
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(input).toHaveAttribute("type", "password");

    fireEvent.click(toggle);

    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("preserves native search and select semantics", () => {
    render(
      <>
        <SearchInput id="member-search" label="Search members" />
        <NativeSelect id="member-status" label="Account status" defaultValue="active">
          <option value="active">Active</option>
          <option value="banned">Banned</option>
        </NativeSelect>
      </>,
    );

    expect(screen.getByRole("searchbox", { name: "Search members" })).toHaveAttribute(
      "type",
      "search",
    );
    expect(screen.getByRole("combobox", { name: "Account status" })).toHaveValue("active");
  });

  it("rejects unsafe avatar sources and keeps a deterministic fallback", async () => {
    expect(safeAvatarUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeAvatarUrl("http://example.com/avatar.png")).toBeUndefined();
    expect(safeAvatarUrl("http://127.0.0.1:54321/avatar.png")).toBe(
      "http://127.0.0.1:54321/avatar.png",
    );
    expect(safeAvatarUrl("https://example.com/avatar.png")).toBe("https://example.com/avatar.png");

    render(<Avatar alt="" name="Din Djarin" src="javascript:alert(1)" />);
    expect(await screen.findByText("DD")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders explicit status text and tone without creating a live region", () => {
    render(<StatusBadge tone="warning">Suspended</StatusBadge>);

    const badge = screen.getByText("Suspended");
    expect(badge).toHaveAttribute("data-tone", "warning");
    expect(badge).not.toHaveAttribute("role", "status");
  });

  it("slots one action link and exposes pending state on real buttons", () => {
    const { rerender } = render(
      <Button asChild variant="secondary">
        <a href="/members">Members</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Members" })).toHaveAttribute("href", "/members");

    rerender(<Button loading>Saving</Button>);
    const button = screen.getByRole("button", { name: "Saving" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});
