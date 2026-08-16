/**
 * Shared result contract and database-error mapping for every clan, rank,
 * badge, friend and block Server Action.
 *
 * Authority is decided server-side by the SECURITY DEFINER RPCs (and RLS as the
 * backstop), so an action never inspects permissions itself: it validates the
 * shape, forwards the call, and maps the database answer onto a stable result
 * code the form can render without ever seeing the raw database message.
 */

export type ClanActionResultCode =
  | "access_denied"
  | "blocked"
  | "conflict"
  | "invalid_input"
  | "invalid_request"
  | "not_found"
  | "rate_limited"
  | "retry";

export type ClanActionResult =
  | { ok: true; message?: string; value?: string }
  | {
      ok: false;
      code: ClanActionResultCode;
      message: string;
      fieldErrors?: Record<string, string>;
    };

export const RETRY_RESULT: ClanActionResult = {
  ok: false,
  code: "retry",
  message: "The change could not be saved. Try again.",
};

export function invalidInput(
  error: { issues: ReadonlyArray<{ path: ReadonlyArray<string | number>; message: string }> },
  message = "Check the highlighted fields and try again.",
): ClanActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }

  return { ok: false, code: "invalid_input", message, fieldErrors };
}

interface DatabaseErrorShape {
  code?: string;
  message?: string;
}

function databaseCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as DatabaseErrorShape).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

function databaseMessage(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as DatabaseErrorShape).message;
    if (typeof message === "string") return message;
  }
  return undefined;
}

/** The friend and clan RPCs raise 42501 with a stable message when a block in
 * either direction stops the request. Detect that case without leaking the raw
 * message to the caller. */
const BLOCK_MESSAGES = [
  "cannot send a request to this member",
  "cannot invite this member",
] as const;

export function databaseFailure(error: unknown): ClanActionResult {
  const code = databaseCode(error);
  const message = databaseMessage(error);

  if (code === "42501" && message && BLOCK_MESSAGES.some((needle) => message.includes(needle))) {
    return { ok: false, code: "blocked", message: "This member cannot receive requests." };
  }

  switch (code) {
    case "42501":
      return { ok: false, code: "access_denied", message: "You cannot perform that action." };
    case "P0002":
      return { ok: false, code: "not_found", message: "That item no longer exists." };
    case "40001":
      return {
        ok: false,
        code: "conflict",
        message: "This changed while you were viewing it. Reload and try again.",
      };
    case "23505":
      return {
        ok: false,
        code: "invalid_request",
        message: "That already exists — choose a different value.",
      };
    case "22023":
      return {
        ok: false,
        code: "invalid_request",
        message: "This change is not valid for the item's current state.",
      };
    case "53400":
      return {
        ok: false,
        code: "rate_limited",
        message: "Too many requests recently. Try again later.",
      };
    default:
      return RETRY_RESULT;
  }
}

export function revalidate(scope: () => void) {
  try {
    scope();
  } catch {
    // The mutation is committed; a cache failure must not invite a retry.
  }
}
