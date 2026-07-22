import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  avatarState: {} as Record<string, unknown>,
  getCurrentProfile: vi.fn(),
  profileState: {} as Record<string, unknown>,
  redirect: vi.fn(),
  resetAvatar: vi.fn(),
  resetState: {} as Record<string, unknown>,
  updateProfile: vi.fn(),
  uploadAvatar: vi.fn(),
}));

vi.mock("@/lib/actions/profile", () => ({
  getCurrentProfile: mocks.getCurrentProfile,
  resetAvatar: mocks.resetAvatar,
  updateProfile: mocks.updateProfile,
  uploadAvatar: mocks.uploadAvatar,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    useFormState: (action: unknown) => [
      action === mocks.updateProfile
        ? mocks.profileState
        : action === mocks.uploadAvatar
          ? mocks.avatarState
          : mocks.resetState,
      vi.fn(),
    ],
    useFormStatus: () => ({ pending: false }),
  };
});

import { ProfileEditor } from "@/app/profile/edit/ProfileEditor";
import ProfileEditError from "@/app/profile/edit/error";
import ProfileEditLoading from "@/app/profile/edit/loading";
import ProfileEditPage from "@/app/profile/edit/page";

function editorProps() {
  return {
    displayName: "Din Djarin",
    bio: "Bounty hunter",
    website: "https://example.com/",
    avatarPath: "00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.webp",
    avatarUrl: "https://storage.test/avatar.webp?token=test",
    profileVisibility: "members" as const,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.profileState = {};
  mocks.avatarState = {};
  mocks.resetState = {};
  mocks.getCurrentProfile.mockResolvedValue({
    status: "ok",
    profile: {
      id: "00000000-0000-4000-8000-000000000001",
      display_name: "Din Djarin",
      avatar_path: null,
      avatarUrl: null,
      bio: "Bounty hunter",
      website: "https://example.com/",
      profile_visibility: "public",
    },
  });
  mocks.redirect.mockImplementation((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  });
});

describe("profile editor", () => {
  it("uses labelled shared controls and bounded editable fields", () => {
    render(<ProfileEditor {...editorProps()} />);

    expect(screen.getByRole("form", { name: "Edit profile" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Upload avatar" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Remove avatar" })).toBeInTheDocument();
    expect(screen.getByLabelText("Avatar image")).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp",
    );
    expect(screen.getByLabelText(/Display name/)).toHaveAttribute("maxlength", "50");
    expect(screen.getByLabelText("Bio")).toHaveAttribute("maxlength", "500");
    expect(screen.getByLabelText("Website")).toHaveAttribute("maxlength", "2048");
    expect(screen.getByLabelText("Profile visibility")).toHaveValue("members");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("associates field errors with their controls", () => {
    mocks.profileState = {
      fieldErrors: {
        displayName: "Display name is invalid",
        bio: "Bio is too long",
        website: "Website is invalid",
      },
    };
    mocks.avatarState = { fieldErrors: { avatar: "Avatar is too large" } };

    render(<ProfileEditor {...editorProps()} />);

    expect(screen.getByLabelText(/Display name/)).toHaveAccessibleDescription(
      "Display name is invalid",
    );
    expect(screen.getByLabelText("Bio")).toHaveAccessibleDescription("Bio is too long");
    expect(screen.getByLabelText("Website")).toHaveAccessibleDescription(
      "Only http and https addresses are accepted. Website is invalid",
    );
    expect(screen.getByLabelText("Avatar image")).toHaveAccessibleDescription(
      expect.stringContaining("Avatar is too large"),
    );
  });

  it("announces success and failure states", () => {
    mocks.profileState = { success: "Profile updated." };
    const { rerender } = render(<ProfileEditor {...editorProps()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Profile updated");

    mocks.profileState = { error: "Changes could not be saved." };
    rerender(<ProfileEditor {...editorProps()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Changes could not be saved");
  });

  it("reports avatar cleanup warnings without hiding successful state", () => {
    mocks.avatarState = {
      success: "Avatar updated.",
      warning: "The previous avatar may need cleanup.",
    };

    render(<ProfileEditor {...editorProps()} />);
    expect(screen.getAllByRole("status").map((status) => status.textContent)).toEqual([
      "Avatar updated.",
      "The previous avatar may need cleanup.",
    ]);
  });
});

describe("profile edit page states", () => {
  it("provides an announced loading state", () => {
    render(<ProfileEditLoading />);

    expect(screen.getByLabelText("Loading profile editor")).toHaveAttribute("aria-busy", "true");
  });

  it("recovers from an unexpected route error without logging its message", () => {
    const reset = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ProfileEditError
        error={Object.assign(new Error("sensitive detail"), { digest: "profile-123" })}
        reset={reset}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith("Profile editor failed to load.", {
      digest: "profile-123",
    });
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining("sensitive detail"));
    consoleError.mockRestore();
  });

  it("preserves the intended destination for signed-out users", async () => {
    mocks.getCurrentProfile.mockResolvedValue({ status: "unauthenticated" });

    await expect(ProfileEditPage()).rejects.toThrow("NEXT_REDIRECT:/auth/login?next=/profile/edit");
  });

  it("does not misreport a database failure as signed out", async () => {
    mocks.getCurrentProfile.mockResolvedValue({ status: "error" });

    render(await ProfileEditPage());
    expect(screen.getByRole("alert")).toHaveTextContent("temporarily unavailable");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("renders a local denial without exposing the editor", async () => {
    mocks.getCurrentProfile.mockResolvedValue({
      status: "denied",
      reason: "account_suspended",
      message: "This account cannot edit profiles.",
    });

    render(await ProfileEditPage());
    expect(screen.getByRole("alert")).toHaveTextContent("cannot edit profiles");
    expect(screen.queryByRole("form", { name: "Edit profile" })).toBeNull();
  });
});
