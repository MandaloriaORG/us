"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { WarningCircleIcon, CheckCircleIcon, EnvelopeIcon } from "@phosphor-icons/react/dist/ssr";
import { motion, useReducedMotion } from "framer-motion";
import { AuthShell } from "@/app/auth/AuthShell";
import { AuthHeading } from "@/app/auth/AuthHeading";
import { TextInput } from "@/components/origin/text-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { resendVerification, type AuthResult } from "@/lib/actions/auth";

const initialState: AuthResult = {};

const field = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };

export default function VerifyEmailPage() {
  const [state, formAction] = useFormState(resendVerification, initialState);
  const reduced = useReducedMotion();

  return (
    <AuthShell>
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="border-brand/40 bg-bg-raised mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border shadow-[0_0_20px_-6px_hsl(42_40%_55%/0.5),inset_0_1px_0_hsl(42_40%_55%/0.25)]">
          <EnvelopeIcon aria-hidden="true" className="text-brand h-6 w-6" />
        </div>
        <AuthHeading
          title="Check your email"
          subtitle="Open the verification link we sent to activate your account."
        />
      </motion.div>

      {state.success ? (
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            role="status"
            className="border-success/30 text-success mt-6 flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <CheckCircleIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            If that account is awaiting verification, a new link is on its way.
          </div>
        </motion.div>
      ) : (
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
              label="Need another verification link?"
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
              Resend verification link
            </SubmitButton>
          </motion.div>
        </motion.form>
      )}

      <motion.div
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <Link
          href="/auth/login"
          className="text-fg-muted duration-fast hover:text-fg focus:ring-border-focus mt-4 flex min-h-11 items-center justify-center text-sm underline-offset-4 transition-colors hover:underline focus:ring-2 focus:outline-hidden"
        >
          Back to sign in
        </Link>
      </motion.div>
    </AuthShell>
  );
}
