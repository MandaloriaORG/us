"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { WarningCircleIcon, CheckCircleIcon, EnvelopeIcon } from "@phosphor-icons/react/dist/ssr";
import { AuthShell } from "@/app/auth/AuthShell";
import { TextInput } from "@/components/origin/text-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { resendVerification, type AuthResult } from "@/lib/actions/auth";

const initialState: AuthResult = {};

export default function VerifyEmailPage() {
  const [state, formAction] = useFormState(resendVerification, initialState);

  return (
    <AuthShell>
      <EnvelopeIcon aria-hidden="true" className="text-brand mx-auto h-8 w-8" />
      <h1 className="text-fg mt-4 text-center text-2xl font-semibold">Check your email</h1>
      <p className="text-fg-muted mt-2 text-center text-sm">
        Open the verification link we sent to activate your account.
      </p>

      {state.success ? (
        <div
          role="status"
          className="border-success/30 text-success mt-6 flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <CheckCircleIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          If that account is awaiting verification, a new link is on its way.
        </div>
      ) : (
        <form action={formAction} className="mt-6 space-y-4">
          <TextInput
            id="email"
            name="email"
            type="email"
            label="Need another verification link?"
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
            Resend verification link
          </SubmitButton>
        </form>
      )}

      <Link
        href="/auth/login"
        className="text-fg-muted duration-fast hover:text-fg focus:ring-border-focus mt-4 flex min-h-11 items-center justify-center text-sm underline-offset-4 transition-colors hover:underline focus:ring-2 focus:outline-hidden"
      >
        Back to sign in
      </Link>
    </AuthShell>
  );
}
