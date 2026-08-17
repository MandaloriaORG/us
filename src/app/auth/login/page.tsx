"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useFormState } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { WarningCircleIcon, CheckCircleIcon, EnvelopeIcon } from "@phosphor-icons/react/dist/ssr";
import { AuthShell } from "@/app/auth/AuthShell";
import { AuthHeading } from "@/app/auth/AuthHeading";
import { PasswordInput } from "@/components/origin/password-input";
import { TextInput } from "@/components/origin/text-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { login, type AuthResult } from "@/lib/actions/auth";

const initialState: AuthResult = {};

const reasonMessages: Record<string, { kind: "error" | "success"; text: string }> = {
  banned: { kind: "error", text: "This account is banned and cannot sign in." },
  confirmation_failed: {
    kind: "error",
    text: "That confirmation link is invalid or has expired.",
  },
  password_updated: {
    kind: "success",
    text: "Your password was updated. Sign in with your new password.",
  },
  session_unavailable: {
    kind: "error",
    text: "We could not verify your session. Sign in again.",
  },
  suspended: {
    kind: "error",
    text: "This account is suspended. Contact the Council if you need help.",
  },
};

export default function LoginPage() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const reason = reasonMessages[searchParams.get("reason") ?? ""];
  const [state, formAction] = useFormState(login, initialState);
  const reduced = useReducedMotion();

  return (
    <AuthShell>
      <AuthHeading title="Sign in" subtitle="Access your Mandaloria account." />

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
        <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
          <input type="hidden" name="next" value={next} />
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
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

        <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
          <PasswordInput
            id="password"
            name="password"
            label="Password"
            autoComplete="current-password"
            required
            error={state.fieldErrors?.password}
          />
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
          {reason && (
            <div
              role={reason.kind === "error" ? "alert" : "status"}
              className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                reason.kind === "error"
                  ? "border-error/30 text-error"
                  : "border-success/30 text-success"
              }`}
            >
              {reason.kind === "error" ? (
                <WarningCircleIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <CheckCircleIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              {reason.text}
            </div>
          )}
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
          {state.error && (
            <div
              role="alert"
              className="border-error/30 text-error flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <WarningCircleIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {state.error}
                {state.errorCode === "email_unverified" && (
                  <Link href="/auth/verify-email" className="ml-1 underline underline-offset-4">
                    Send a new link.
                  </Link>
                )}
              </span>
            </div>
          )}
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
          <div className="flex min-h-11 items-center justify-end">
            <Link
              href="/auth/forgot-password"
              className="text-fg-muted duration-fast hover:text-fg focus:ring-border-focus inline-flex min-h-11 items-center text-sm underline-offset-4 transition-colors hover:underline focus:ring-2 focus:outline-hidden"
            >
              Forgot password?
            </Link>
          </div>
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
          <SubmitButton className="w-full" pendingLabel="Signing in…">
            Sign in
          </SubmitButton>
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
          <p className="text-fg-muted text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/auth/register" className="text-brand underline-offset-4 hover:underline">
              Create one
            </Link>
          </p>
        </motion.div>
      </motion.form>
    </AuthShell>
  );
}
