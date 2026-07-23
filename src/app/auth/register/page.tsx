"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { WarningCircleIcon, EnvelopeIcon, UserIcon } from "@phosphor-icons/react/dist/ssr";
import { AuthShell } from "@/app/auth/AuthShell";
import { PasswordInput } from "@/components/origin/password-input";
import { TextInput } from "@/components/origin/text-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { register, type AuthResult } from "@/lib/actions/auth";

const initialState: AuthResult = {};

export default function RegisterPage() {
  const [state, formAction] = useFormState(register, initialState);

  return (
    <AuthShell>
      <h1 className="text-fg text-center text-2xl font-semibold">Create your account</h1>
      <p className="text-fg-muted mt-1 text-center text-sm">Join the Mandaloria community.</p>

      <form action={formAction} className="mt-6 space-y-4">
        <TextInput
          id="displayName"
          name="displayName"
          type="text"
          label="Display name"
          icon={UserIcon}
          autoComplete="nickname"
          required
          minLength={2}
          maxLength={50}
          placeholder="Your community name"
          error={state.fieldErrors?.displayName}
        />

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

        <PasswordInput
          id="password"
          name="password"
          label="Password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          error={state.fieldErrors?.password}
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

        <SubmitButton className="w-full" pendingLabel="Creating account…">
          Create account
        </SubmitButton>

        <p className="text-fg-muted text-center text-sm">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-brand underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
