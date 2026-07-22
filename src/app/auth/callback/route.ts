import { NextResponse } from "next/server";
import { safeRedirectPath } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback — handles email confirmation and OAuth redirects.
 * Supabase redirects here with a `code` query parameter after email verification.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeRedirectPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(
      new URL("/auth/login?reason=confirmation_failed", requestUrl.origin),
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, requestUrl.origin));
  } catch {
    // The public redirect below keeps provider and infrastructure details private.
  }

  return NextResponse.redirect(
    new URL("/auth/login?reason=confirmation_failed", requestUrl.origin),
  );
}
