"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { AuthShell } from "@/app/auth/AuthShell";
import { AuthHeading } from "@/app/auth/AuthHeading";
import { PasswordInput } from "@/components/origin/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { resetPassword, type AuthResult } from "@/lib/actions/auth";

const initialState: AuthResult = {};

const field = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };

export default function ResetPasswordPage() {
  const [state, formAction] = useFormState(resetPassword, initialState);
  const reduced = useReducedMotion();

  return (
    <AuthShell>
      <AuthHeading
        title="Choose a new password"
        subtitle="Use at least eight characters and confirm the new password."
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
        </motion.div>

        <motion.div variants={field}>
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
        </motion.div>

        <motion.div variants={field}>
          {state.error && (
            <div
              role="alert"
              className="border-error/30 text-error flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <WarningCircleIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
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
        </motion.div>

        <motion.div variants={field}>
          <SubmitButton className="w-full" pendingLabel="Updating password…">
            Update password
          </SubmitButton>
        </motion.div>
      </motion.form>
    </AuthShell>
  );
}
