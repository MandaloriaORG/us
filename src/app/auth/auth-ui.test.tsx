import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  pending: false,
  search: new URLSearchParams(),
}));

vi.mock("@/lib/actions/auth", () => ({
  forgotPassword: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  resendVerification: vi.fn(),
  resetPassword: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => mocks.search,
}));
vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    useFormState: () => [mocks.state, vi.fn()],
    useFormStatus: () => ({ pending: mocks.pending }),
  };
});

import ForgotPasswordPage from "@/app/auth/forgot-password/page";
import LoginPage from "@/app/auth/login/page";
import RegisterPage from "@/app/auth/register/page";
import ResetPasswordPage from "@/app/auth/reset-password/page";
import VerifyEmailPage from "@/app/auth/verify-email/page";

beforeEach(() => {
  mocks.state = {};
  mocks.pending = false;
  mocks.search = new URLSearchParams();
});

describe("Auth forms", () => {
  it("renders labelled login controls with an accessible password toggle", () => {
    render(<LoginPage />);
    const password = screen.getByLabelText(/Password/);
    expect(screen.getByLabelText(/Email/)).toHaveAttribute("autocomplete", "email");
    expect(password).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveClass("h-11", "w-11");
  });

  it("associates field validation with the invalid control", () => {
    mocks.state = { fieldErrors: { email: "Enter a valid email address" } };
    render(<LoginPage />);
    const email = screen.getByLabelText(/Email/);
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Enter a valid email address");
  });

  it("offers a resend action for an unverified login", () => {
    mocks.state = {
      error: "Verify your email before signing in.",
      errorCode: "email_unverified",
    };
    render(<LoginPage />);
    expect(screen.getByRole("alert")).toHaveTextContent("Verify your email");
    expect(screen.getByRole("link", { name: "Send a new link." })).toHaveAttribute(
      "href",
      "/auth/verify-email",
    );
  });

  it("renders a pending label and disables submission", () => {
    mocks.pending = true;
    render(<RegisterPage />);
    const submit = screen.getByRole("button", { name: /Creating account/ });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute("aria-disabled", "true");
  });
});

describe("Auth flow states", () => {
  it("does not show password-recovery success before submission", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByRole("heading", { name: "Reset your password" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
  });

  it("shows a non-enumerating password-recovery success", () => {
    mocks.state = { success: true };
    render(<ForgotPasswordPage />);
    expect(screen.getByRole("status")).toHaveTextContent("If an account uses that address");
  });

  it("provides an accessible resend-verification form", () => {
    render(<VerifyEmailPage />);
    expect(screen.getByLabelText(/Need another verification link?/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resend verification link" })).toBeInTheDocument();
  });

  it("requires and labels both reset-password fields", () => {
    render(<ResetPasswordPage />);
    expect(screen.getByLabelText(/New password/)).toHaveAttribute("required");
    expect(screen.getByLabelText(/Confirm new password/)).toHaveAttribute("required");
  });

  it("offers recovery when the reset session has expired", () => {
    mocks.state = { error: "Expired", errorCode: "session_expired" };
    render(<ResetPasswordPage />);
    expect(screen.getByRole("link", { name: "Request another link." })).toHaveAttribute(
      "href",
      "/auth/forgot-password",
    );
  });
});
