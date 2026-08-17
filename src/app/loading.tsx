import { CircleNotchIcon } from "@phosphor-icons/react/dist/ssr";

export default function RootLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[60vh] items-center justify-center"
    >
      <div className="flex flex-col items-center gap-3">
        <CircleNotchIcon aria-hidden="true" className="text-brand h-7 w-7 animate-spin" />
        <p className="text-fg-muted text-xs font-medium tracking-wide uppercase">Loading</p>
      </div>
    </div>
  );
}