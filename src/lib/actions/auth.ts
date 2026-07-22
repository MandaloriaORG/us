"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSiteOrigin, readAccountStatus, safeRedirectPath } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

// ── Schemas ──

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

const registerSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z
    .string({ invalid_type_error: "Enter a display name" })
    .max(50, "Display name must be at most 50 characters")
    .refine(
      (value) => !/[\u0000-\u001f\u007f]/.test(value),
      "Display name contains unsupported characters",
    )
    .transform((value) => value.normalize("NFKC").trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(2, "Display name must be at least 2 characters")
        .max(50, "Display name must be at most 50 characters"),
    ),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const resendVerificationSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

// ── Types ──

export interface AuthResult {
  error?: string;
  errorCode?:
    | "account_banned"
    | "account_suspended"
    | "email_unverified"
    | "invalid_credentials"
    | "rate_limited"
    | "session_expired"
    | "verification_failed";
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

function fieldErrors(error: z.ZodError) {
  return Object.fromEntries(error.errors.map((issue) => [issue.path[0] as string, issue.message]));
}

async function clearSession(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    await supabase.auth.signOut();
  } catch {
    // Best-effort cleanup after a fail-closed account check.
  }
}

// ── Login ──

export async function login(
  _prevState: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error) };
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    return {
      error: "Sign-in is temporarily unavailable. Try again.",
      errorCode: "verification_failed",
    };
  }

  let signInResult: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
  try {
    signInResult = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
  } catch {
    return {
      error: "Sign-in is temporarily unavailable. Try again.",
      errorCode: "verification_failed",
    };
  }
  const { data, error } = signInResult;

  if (error) {
    if (error.code === "email_not_confirmed" || error.message === "Email not confirmed") {
      return {
        error: "Verify your email before signing in.",
        errorCode: "email_unverified",
      };
    }

    if (
      error.status === 429 ||
      error.code === "over_request_rate_limit" ||
      error.code === "over_email_send_rate_limit"
    ) {
      return {
        error: "Too many sign-in attempts. Try again later.",
        errorCode: "rate_limited",
      };
    }

    if (error.code === "invalid_credentials" || error.message === "Invalid login credentials") {
      return {
        error: "The email or password is incorrect.",
        errorCode: "invalid_credentials",
      };
    }

    return {
      error: "Sign-in is temporarily unavailable. Try again.",
      errorCode: "verification_failed",
    };
  }

  if (!data.user) {
    await clearSession(supabase);
    return {
      error: "We could not verify your account. Try again.",
      errorCode: "verification_failed",
    };
  }

  const account = await readAccountStatus(supabase, data.user.id);
  if (!account.ok) {
    await clearSession(supabase);
    return {
      error: "We could not verify your account. Try again.",
      errorCode: "verification_failed",
    };
  }

  if (account.status !== "active") {
    await clearSession(supabase);
    const suspended = account.status === "suspended";
    return {
      error: suspended
        ? "This account is suspended. Contact the Council if you need help."
        : "This account is banned and cannot sign in.",
      errorCode: suspended ? "account_suspended" : "account_banned",
    };
  }

  redirect(safeRedirectPath(formData.get("next")));
}

// ── Register ──

export async function register(
  _prevState: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error) };
  }

  const origin = getSiteOrigin();
  if (!origin) {
    return { error: "Registration is temporarily unavailable." };
  }

  let signUpResult: Awaited<ReturnType<Awaited<ReturnType<typeof createClient>>["auth"]["signUp"]>>;
  try {
    const supabase = await createClient();
    signUpResult = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        data: {
          display_name: parsed.data.displayName,
        },
      },
    });
  } catch {
    return { error: "Registration is temporarily unavailable. Try again." };
  }
  const { data, error } = signUpResult;

  if (error) {
    return { error: "We could not create your account. Try again." };
  }

  if (data.session) redirect("/");
  redirect("/auth/verify-email");
}

// ── Logout ──

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// ── Forgot Password ──

export async function forgotPassword(
  _prevState: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error) };
  }

  const origin = getSiteOrigin();
  if (!origin) {
    return { error: "Password recovery is temporarily unavailable." };
  }

  let error: { message: string } | null;
  try {
    const supabase = await createClient();
    ({ error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
    }));
  } catch {
    return { error: "We could not send a reset link. Try again later." };
  }

  if (error) {
    return { error: "We could not send a reset link. Try again later." };
  }

  return { success: true };
}

// ── Resend verification ──

export async function resendVerification(
  _prevState: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = resendVerificationSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error) };
  }

  const origin = getSiteOrigin();
  if (!origin) return { error: "Email verification is temporarily unavailable." };

  let error: { message: string } | null;
  try {
    const supabase = await createClient();
    ({ error } = await supabase.auth.resend({
      type: "signup",
      email: parsed.data.email,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    }));
  } catch {
    return { error: "We could not send a new link. Try again later." };
  }

  if (error) return { error: "We could not send a new link. Try again later." };
  return { success: true };
}

// ── Reset password (after clicking email link) ──

export async function resetPassword(
  _prevState: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  let supabase: Awaited<ReturnType<typeof createClient>>;
  let userResult: Awaited<ReturnType<Awaited<ReturnType<typeof createClient>>["auth"]["getUser"]>>;
  try {
    supabase = await createClient();
    userResult = await supabase.auth.getUser();
  } catch {
    return {
      error: "We could not verify the reset session. Try again.",
      errorCode: "verification_failed",
    };
  }
  const {
    data: { user },
    error: userError,
  } = userResult;

  if (userError || !user) {
    return {
      error: "This password reset link has expired. Request a new one.",
      errorCode: "session_expired",
    };
  }

  let error: { message: string } | null;
  try {
    ({ error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    }));
  } catch {
    return { error: "We could not update your password. Try again." };
  }

  if (error) {
    return { error: "We could not update your password. Try again." };
  }

  redirect("/auth/login?reason=password_updated");
}
