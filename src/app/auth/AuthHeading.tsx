interface AuthHeadingProps {
  title: string;
  subtitle?: string;
}

export function AuthHeading({ title, subtitle }: AuthHeadingProps) {
  return (
    <header className="text-center">
      <h1 className="text-fg font-display text-[1.55rem] leading-tight font-semibold tracking-wide">
        {title}
      </h1>
      {subtitle ? <p className="text-fg-muted mt-2 text-sm">{subtitle}</p> : null}
    </header>
  );
}
