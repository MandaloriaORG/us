"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useFormState } from "react-dom";
import { AlertCircle, CheckCircle, Mail } from "lucide-react";
import { AuthShell } from "@/app/auth/AuthShell";
import { PasswordInput } from "@/components/origin/password-input";
import { TextInput } from "@/components/origin/text-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { login, type AuthResult } from "@/lib/actions/auth";

const initialState: AuthResult = {};

const reasonMessages: Record<string, { kind: "error" | "success"; text: string }> = {
  banned: { kind: "error", text: "This account is banned and cannot sign in." },
  confirmation_failed: {
    kind: "error",
    text: "That confirmation link is invalid or has expired.",
  },
  password_updated: {
    kind: "success",
    text: "Your password was updated. Sign in with your new password.",
  },
  session_unavailable: {
    kind: "error",
    text: "We could not verify your session. Sign in again.",
  },
  suspended: {
    kind: "error",
    text: "This account is suspended. Contact the Council if you need help.",
  },
};

export default function LoginPage() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const reason = reasonMessages[searchParams.get("reason") ?? ""];
  const [state, formAction] = useFormState(login, initialState);

  return (
    <AuthShell>
      <h1 className="text-center text-2xl font-semibold text-fg">Sign in</h1>
      <p className="mt-1 text-center text-sm text-fg-muted">Access your Mandaloria account.</p>

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />

        <TextInput
          id="email"
          name="email"
          type="email"
          label="Email"
          icon={Mail}
          autoComplete="email"
          required
          placeholder="you@example.com"
          error={state.fieldErrors?.email}
        />

        <PasswordInput
          id="password"
          name="password"
          label="Password"
          autoComplete="current-password"
          required
          error={state.fieldErrors?.password}
        />

        {reason && (
          <div
            role={reason.kind === "error" ? "alert" : "status"}
            className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
              reason.kind === "error"
                ? "border-error/30 text-error"
                : "border-success/30 text-success"
            }`}
          >
            {reason.kind === "error" ? (
              <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            {reason.text}
          </div>
        )}

        {state.error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-error/30 px-3 py-2 text-sm text-error"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {state.error}
              {state.errorCode === "email_unverified" && (
                <Link href="/auth/verify-email" className="ml-1 underline underline-offset-4">
                  Send a new link.
                </Link>
              )}
            </span>
          </div>
        )}

        <div className="flex min-h-11 items-center justify-end">
          <Link
            href="/auth/forgot-password"
            className="inline-flex min-h-11 items-center text-sm text-fg-muted underline-offset-4 transition-colors duration-fast hover:text-fg hover:underline focus:outline-none focus:ring-2 focus:ring-border-focus"
          >
            Forgot password?
          </Link>
        </div>

        <SubmitButton className="w-full" pendingLabel="Signing in…">
          Sign in
        </SubmitButton>

        <p className="text-center text-sm text-fg-muted">
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="text-brand underline-offset-4 hover:underline">
            Create one
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
