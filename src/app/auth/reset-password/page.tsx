"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { AlertCircle } from "lucide-react";
import { AuthShell } from "@/app/auth/AuthShell";
import { PasswordInput } from "@/components/origin/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { resetPassword, type AuthResult } from "@/lib/actions/auth";

const initialState: AuthResult = {};

export default function ResetPasswordPage() {
  const [state, formAction] = useFormState(resetPassword, initialState);

  return (
    <AuthShell>
      <h1 className="text-center text-2xl font-semibold text-fg">Choose a new password</h1>
      <p className="mt-1 text-center text-sm text-fg-muted">
        Use at least eight characters and confirm the new password.
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        <PasswordInput
          id="password"
          name="password"
          label="New password"
          autoComplete="new-password"
          required
          minLength={8}
          error={state.fieldErrors?.password}
          showPasswordLabel="Show new password"
          hidePasswordLabel="Hide new password"
        />
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          label="Confirm new password"
          autoComplete="new-password"
          required
          minLength={8}
          error={state.fieldErrors?.confirmPassword}
          showPasswordLabel="Show password confirmation"
          hidePasswordLabel="Hide password confirmation"
        />

        {state.error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-error/30 px-3 py-2 text-sm text-error"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {state.error}
              {state.errorCode === "session_expired" && (
                <Link href="/auth/forgot-password" className="ml-1 underline underline-offset-4">
                  Request another link.
                </Link>
              )}
            </span>
          </div>
        )}

        <SubmitButton className="w-full" pendingLabel="Updating password…">
          Update password
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
