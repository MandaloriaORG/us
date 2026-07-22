"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { AlertCircle, ArrowLeft, CheckCircle, Mail } from "lucide-react";
import { AuthShell } from "@/app/auth/AuthShell";
import { TextInput } from "@/components/origin/text-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { forgotPassword, type AuthResult } from "@/lib/actions/auth";

const initialState: AuthResult = {};

export default function ForgotPasswordPage() {
  const [state, formAction] = useFormState(forgotPassword, initialState);

  return (
    <AuthShell>
      {state.success ? (
        <div className="text-center" role="status">
          <CheckCircle aria-hidden="true" className="mx-auto h-8 w-8 text-success" />
          <h1 className="mt-4 text-2xl font-semibold text-fg">Check your email</h1>
          <p className="mt-2 text-sm text-fg-muted">
            If an account uses that address, a password reset link is on its way.
          </p>
          <Link
            href="/auth/login"
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border px-4 text-sm font-medium text-fg transition-colors duration-fast hover:bg-surface focus:outline-none focus:ring-2 focus:ring-border-focus"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <h1 className="text-center text-2xl font-semibold text-fg">Reset your password</h1>
          <p className="mt-1 text-center text-sm text-fg-muted">
            Enter your account email to receive a reset link.
          </p>

          <form action={formAction} className="mt-6 space-y-4">
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

            {state.error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-error/30 px-3 py-2 text-sm text-error"
              >
                <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                {state.error}
              </div>
            )}

            <SubmitButton className="w-full" pendingLabel="Sending link…">
              Send reset link
            </SubmitButton>

            <Link
              href="/auth/login"
              className="flex min-h-11 items-center justify-center gap-2 text-sm text-fg-muted transition-colors duration-fast hover:text-fg focus:outline-none focus:ring-2 focus:ring-border-focus"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Back to sign in
            </Link>
          </form>
        </>
      )}
    </AuthShell>
  );
}
