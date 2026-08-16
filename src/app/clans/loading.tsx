export default function ClansLoading() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="bg-fg-subtle/40 h-8 w-48 animate-pulse rounded-md" />
          <div className="bg-fg-subtle/30 mt-2 h-4 w-72 animate-pulse rounded-md" />
        </div>
      </div>
      <div className="border-border mt-8 space-y-2 rounded-md border p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="bg-fg-subtle/30 h-10 w-10 animate-pulse rounded-md" />
            <div className="flex-1 space-y-2">
              <div className="bg-fg-subtle/40 h-3.5 w-40 animate-pulse rounded-md" />
              <div className="bg-fg-subtle/30 h-3 w-64 animate-pulse rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
