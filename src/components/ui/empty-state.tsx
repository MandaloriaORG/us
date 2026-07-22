import Link from "next/link";
import { cn } from "@/lib/cn";

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
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      {/* Icon — sober, contextual */}
      {icon && (
        <div className="mb-6 rounded-full border border-border bg-bg-raised p-5 text-fg-muted">
          {icon}
        </div>
      )}

      {/* Title */}
      <h3 className="text-xl font-semibold text-fg">{title}</h3>

      {/* Description — why empty, what user can do */}
      {description && <p className="mt-2 max-w-md text-sm text-fg-muted">{description}</p>}

      {/* Actions */}
      <div className="mt-6 flex items-center gap-3">
        {action &&
          (action.href ? (
            <Link
              href={action.href}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-5 text-sm font-medium text-brand-fg transition-colors duration-fast hover:opacity-90"
            >
              {action.label}
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-5 text-sm font-medium text-brand-fg transition-colors duration-fast hover:opacity-90"
            >
              {action.label}
            </button>
          ))}

        {secondaryAction &&
          (secondaryAction.href ? (
            <Link
              href={secondaryAction.href}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-5 text-sm font-medium text-fg transition-colors duration-fast hover:bg-surface"
            >
              {secondaryAction.label}
            </Link>
          ) : (
            <button
              onClick={secondaryAction.onClick}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-5 text-sm font-medium text-fg transition-colors duration-fast hover:bg-surface"
            >
              {secondaryAction.label}
            </button>
          ))}
      </div>
    </div>
  );
}
