"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import {
  WarningCircleIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  EnvelopeIcon,
} from "@phosphor-icons/react/dist/ssr";
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
          <CheckCircleIcon aria-hidden="true" className="text-success mx-auto h-8 w-8" />
          <h1 className="text-fg mt-4 text-2xl font-semibold">Check your email</h1>
          <p className="text-fg-muted mt-2 text-sm">
            If an account uses that address, a password reset link is on its way.
          </p>
          <Link
            href="/auth/login"
            className="border-border text-fg duration-fast hover:bg-surface focus:ring-border-focus mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors focus:ring-2 focus:outline-hidden"
          >
            <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <h1 className="text-fg text-center text-2xl font-semibold">Reset your password</h1>
          <p className="text-fg-muted mt-1 text-center text-sm">
            Enter your account email to receive a reset link.
          </p>

          <form action={formAction} className="mt-6 space-y-4">
            <TextInput
              id="email"
              name="email"
              type="email"
              label="Email"
              icon={EnvelopeIcon}
              autoComplete="email"
              required
              placeholder="you@example.com"
              error={state.fieldErrors?.email}
            />

            {state.error && (
              <div
                role="alert"
                className="border-error/30 text-error flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <WarningCircleIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                {state.error}
              </div>
            )}

            <SubmitButton className="w-full" pendingLabel="Sending link…">
              Send reset link
            </SubmitButton>

            <Link
              href="/auth/login"
              className="text-fg-muted duration-fast hover:text-fg focus:ring-border-focus flex min-h-11 items-center justify-center gap-2 text-sm transition-colors focus:ring-2 focus:outline-hidden"
            >
              <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
              Back to sign in
            </Link>
          </form>
        </>
      )}
    </AuthShell>
  );
}
