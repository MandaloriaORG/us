"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { AlertCircle, Mail, User } from "lucide-react";
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
      <h1 className="text-center text-2xl font-semibold text-fg">Create your account</h1>
      <p className="mt-1 text-center text-sm text-fg-muted">Join the Mandaloria community.</p>

      <form action={formAction} className="mt-6 space-y-4">
        <TextInput
          id="displayName"
          name="displayName"
          type="text"
          label="Display name"
          icon={User}
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
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          error={state.fieldErrors?.password}
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

        <SubmitButton className="w-full" pendingLabel="Creating account…">
          Create account
        </SubmitButton>

        <p className="text-center text-sm text-fg-muted">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-brand underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
