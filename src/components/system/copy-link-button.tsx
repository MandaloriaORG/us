"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, LinkIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";

export interface CopyLinkButtonProps {
  /** Appended to `window.location.origin` at click time, e.g. `/posts/123#comment-9`. */
  path: string;
  label?: string;
}

type Status = "idle" | "copied" | "failed";

/** Synchronous fallback for browsers/contexts where the async Clipboard API is
 *  unavailable or refused (insecure context, iframe, permission denial). */
function legacyCopy(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

/**
 * Copies an absolute link to the clipboard and shows a brief inline
 * confirmation at the button itself (never a toast — this is local,
 * immediate feedback, not a background/cross-page event). Icon and label both
 * change state, so the feedback never relies on colour alone.
 */
export function CopyLinkButton({ path, label = "Copy link" }: CopyLinkButtonProps) {
  const [status, setStatus] = useState<Status>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  async function handleClick() {
    const url = `${window.location.origin}${path}`;
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      ok = legacyCopy(url);
    }

    setStatus(ok ? "copied" : "failed");
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <Button type="button" size="sm" variant="ghost" onClick={handleClick}>
      {status === "copied" ? (
        <CheckIcon aria-hidden="true" className="h-4 w-4" />
      ) : status === "failed" ? (
        <WarningCircleIcon aria-hidden="true" className="h-4 w-4" />
      ) : (
        <LinkIcon aria-hidden="true" className="h-4 w-4" />
      )}
      {status === "copied" ? "Copied" : status === "failed" ? "Copy failed" : label}
    </Button>
  );
}
