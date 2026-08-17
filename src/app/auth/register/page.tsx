"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormState } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { WarningCircleIcon, EnvelopeIcon, UserIcon } from "@phosphor-icons/react/dist/ssr";
import { AuthShell } from "@/app/auth/AuthShell";
import { AuthHeading } from "@/app/auth/AuthHeading";
import { PasswordStrength } from "@/app/auth/PasswordStrength";
import { PasswordInput } from "@/components/origin/password-input";
import { TextInput } from "@/components/origin/text-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { register, type AuthResult } from "@/lib/actions/auth";

const initialState: AuthResult = {};

const field = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };

export default function RegisterPage() {
  const [state, formAction] = useFormState(register, initialState);
  const [password, setPassword] = useState("");
  const reduced = useReducedMotion();

  return (
    <AuthShell>
      <AuthHeading title="Create your account" subtitle="Join the Mandaloria community." />

      <motion.form
        action={formAction}
        className="mt-6 space-y-4"
        initial={reduced ? false : "hidden"}
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
        }}
      >
        <motion.div variants={field}>
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
        </motion.div>

        <motion.div variants={field}>
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
        </motion.div>

        <motion.div variants={field}>
          <PasswordInput
            id="password"
            name="password"
            label="Password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={state.fieldErrors?.password}
          />
          <PasswordStrength value={password} />
        </motion.div>

        <motion.div variants={field}>
          {state.error && (
            <div
              role="alert"
              className="border-error/30 text-error flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <WarningCircleIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              {state.error}
            </div>
          )}
        </motion.div>

        <motion.div variants={field}>
          <SubmitButton className="w-full" pendingLabel="Creating account…">
            Create account
          </SubmitButton>
        </motion.div>

        <motion.div variants={field}>
          <p className="text-fg-muted text-center text-sm">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-brand underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </motion.div>
      </motion.form>
    </AuthShell>
  );
}
