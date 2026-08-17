export default function ClansLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading clans"
      className="mx-auto w-full max-w-5xl px-6 py-12"
    >
      <div className="flex items-end justify-between gap-4">
        <div aria-hidden="true">
          <div className="bg-fg-subtle/40 h-8 w-48 animate-pulse rounded-md" />
          <div className="bg-fg-subtle/30 mt-2 h-4 w-72 animate-pulse rounded-md" />
        </div>
      </div>
      <div aria-hidden="true" className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="border-border bg-bg-raised overflow-hidden rounded-lg border">
            <div className="from-brand/70 via-brand-muted/40 h-1 animate-pulse bg-gradient-to-r to-amber-500/25" />
            <div className="flex items-start gap-4 p-5">
              <div className="bg-brand-muted/20 h-11 w-11 animate-pulse rounded-md" />
              <div className="flex-1 space-y-2">
                <div className="bg-fg-subtle/40 h-4 w-40 animate-pulse rounded-md" />
                <div className="bg-fg-subtle/30 h-3 w-64 animate-pulse rounded-md" />
                <div className="bg-fg-subtle/30 h-3 w-48 animate-pulse rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
