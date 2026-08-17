"use client";

import { cn } from "@/lib/cn";

function score(value: string): number {
  let s = 0;
  if (value.length >= 8) s += 1;
  if (value.length >= 12) s += 1;
  if (/[A-Z]/.test(value)) s += 1;
  if (/[0-9]/.test(value)) s += 1;
  if (/[^A-Za-z0-9]/.test(value)) s += 1;
  return s;
}

const LEVELS = [
  { label: "Weak", tone: "bg-error/70" },
  { label: "Fair", tone: "bg-warning/70" },
  { label: "Good", tone: "bg-info/70" },
  { label: "Strong", tone: "bg-success/70" },
] as const;

/** Live password-strength hint for the register form. Pure visual; never gates submission. */
export function PasswordStrength({ value }: { value: string }) {
  const s = score(value);
  const level = LEVELS[Math.min(s, LEVELS.length - 1)];

  return (
    <div className="mt-1.5" aria-hidden="true">
      <div
        className={cn(
          "duration-fast grid grid-cols-4 gap-1 transition-opacity",
          value ? "opacity-100" : "opacity-0",
        )}
      >
        {LEVELS.map((l, i) => (
          <span
            key={l.label}
            className={cn(
              "duration-fast h-0.5 rounded-full transition-colors",
              i <= s ? l.tone : "bg-border",
            )}
          />
        ))}
      </div>
      <p className="text-fg-subtle mt-1 text-xs">
        {value
          ? `${level.label} — use 8+ characters with numbers and symbols`
          : "Use 8+ characters"}
      </p>
    </div>
  );
}
