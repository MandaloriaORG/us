import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { readAccountStatus, safeRedirectPath } from "@/lib/supabase/auth";

function redirectWithCookies(response: NextResponse, url: URL) {
  const redirected = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
  return redirected;
}

/**
 * Middleware refreshes the Supabase session on every request
 * and protects routes that require authentication or specific roles.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh session — this reads the auth cookie and sets a new one if needed
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
  let sessionCheckFailed = false;
  try {
    const { data, error } = await supabase.auth.getUser();
    user = data.user;
    sessionCheckFailed = Boolean(error);
  } catch {
    sessionCheckFailed = true;
  }

  const pathname = request.nextUrl.pathname;
  const requestedPath = safeRedirectPath(`${pathname}${request.nextUrl.search}`);

  // ── Protected routes: require authentication ──
  const protectedPaths = ["/profile/edit", "/council"];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  let hasVerifiedActiveAccount = false;

  if (isProtected && !user) {
    const redirectUrl = new URL("/auth/login", request.url);
    if (sessionCheckFailed) redirectUrl.searchParams.set("reason", "session_unavailable");
    redirectUrl.searchParams.set("next", requestedPath);
    return redirectWithCookies(response, redirectUrl);
  }

  if (user) {
    const account = await readAccountStatus(supabase, user.id);

    if (!account.ok && isProtected) {
      const redirectUrl = new URL("/auth/login", request.url);
      redirectUrl.searchParams.set("reason", "session_unavailable");
      redirectUrl.searchParams.set("next", requestedPath);
      return redirectWithCookies(response, redirectUrl);
    }

    if (account.ok) {
      if (account.status !== "active") {
        const redirectUrl = new URL("/auth/login", request.url);
        redirectUrl.searchParams.set("reason", account.status);
        response = NextResponse.redirect(redirectUrl);
        await supabase.auth.signOut();
        return response;
      }

      hasVerifiedActiveAccount = true;
    }
  }

  // ── Auth pages: redirect if already logged in ──
  const authPaths = ["/auth/login", "/auth/register", "/auth/forgot-password"];
  if (authPaths.includes(pathname) && user && hasVerifiedActiveAccount) {
    return redirectWithCookies(response, new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public directory)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
