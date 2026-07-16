export function PageSpinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="relative size-8">
          <div className="absolute inset-0 rounded-full border-2 border-line" />
          <div className="absolute inset-0 animate-spin-slow rounded-full border-2 border-transparent border-t-brand-bright" />
        </div>
        <p className="text-[12px] text-ink-4">Loading…</p>
      </div>
    </div>
  )
}
