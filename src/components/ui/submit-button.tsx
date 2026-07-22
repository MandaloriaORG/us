"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

interface SubmitButtonProps {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}

/**
 * Submit button that reads pending state from the parent form via useFormStatus.
 * Must be rendered inside a <form> that uses a server action.
 */
export function SubmitButton({
  children,
  className,
  pendingLabel = "Working…",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      className={className}
      loading={pending}
      disabled={pending}
      aria-disabled={pending}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
