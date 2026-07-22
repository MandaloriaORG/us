import Link from "next/link";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-10 text-center", className)}>
      {icon && (
        <div aria-hidden="true" className="mb-4 text-fg-subtle">
          {icon}
        </div>
      )}

      <h3 className="text-base font-semibold text-fg">{title}</h3>

      {description && <p className="mt-2 max-w-md text-sm text-fg-muted">{description}</p>}

      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        {action &&
          (action.href ? (
            <Button asChild>
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ) : (
            <Button type="button" onClick={action.onClick}>
              {action.label}
            </Button>
          ))}

        {secondaryAction &&
          (secondaryAction.href ? (
            <Button asChild variant="secondary">
              <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          ))}
      </div>
    </div>
  );
}
