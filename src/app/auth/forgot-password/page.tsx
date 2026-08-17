"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  WarningCircleIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  EnvelopeIcon,
} from "@phosphor-icons/react/dist/ssr";
import { AuthShell } from "@/app/auth/AuthShell";
import { AuthHeading } from "@/app/auth/AuthHeading";
import { TextInput } from "@/components/origin/text-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { forgotPassword, type AuthResult } from "@/lib/actions/auth";

const initialState: AuthResult = {};

const field = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };

export default function ForgotPasswordPage() {
  const [state, formAction] = useFormState(forgotPassword, initialState);
  const reduced = useReducedMotion();

  return (
    <AuthShell>
      {state.success ? (
        <motion.div
          className="text-center"
          role="status"
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <CheckCircleIcon aria-hidden="true" className="text-success mx-auto h-9 w-9" />
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
        </motion.div>
      ) : (
        <>
          <AuthHeading
            title="Reset your password"
            subtitle="Enter your account email to receive a reset link."
          />

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
              <SubmitButton className="w-full" pendingLabel="Sending link…">
                Send reset link
              </SubmitButton>
            </motion.div>

            <motion.div variants={field}>
              <Link
                href="/auth/login"
                className="text-fg-muted duration-fast hover:text-fg focus:ring-border-focus flex min-h-11 items-center justify-center gap-2 text-sm transition-colors focus:ring-2 focus:outline-hidden"
              >
                <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
                Back to sign in
              </Link>
            </motion.div>
          </motion.form>
        </>
      )}
    </AuthShell>
  );
}
