"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { AlertCircle, CheckCircle, Mail } from "lucide-react";
import { AuthShell } from "@/app/auth/AuthShell";
import { TextInput } from "@/components/origin/text-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { resendVerification, type AuthResult } from "@/lib/actions/auth";

const initialState: AuthResult = {};

export default function VerifyEmailPage() {
  const [state, formAction] = useFormState(resendVerification, initialState);

  return (
    <AuthShell>
      <Mail aria-hidden="true" className="mx-auto h-8 w-8 text-brand" />
      <h1 className="mt-4 text-center text-2xl font-semibold text-fg">Check your email</h1>
      <p className="mt-2 text-center text-sm text-fg-muted">
        Open the verification link we sent to activate your account.
      </p>

      {state.success ? (
        <div
          role="status"
          className="mt-6 flex items-start gap-2 rounded-md border border-success/30 px-3 py-2 text-sm text-success"
        >
          <CheckCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          If that account is awaiting verification, a new link is on its way.
        </div>
      ) : (
        <form action={formAction} className="mt-6 space-y-4">
          <TextInput
            id="email"
            name="email"
            type="email"
            label="Need another verification link?"
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
            Resend verification link
          </SubmitButton>
        </form>
      )}

      <Link
        href="/auth/login"
        className="mt-4 flex min-h-11 items-center justify-center text-sm text-fg-muted underline-offset-4 transition-colors duration-fast hover:text-fg hover:underline focus:outline-none focus:ring-2 focus:ring-border-focus"
      >
        Back to sign in
      </Link>
    </AuthShell>
  );
}
