export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div
        aria-hidden="true"
        className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-background shadow-lg shadow-black/40 ring-1 ring-accent-gold/40"
      >
        <span className="font-display text-xl font-black text-accent-gold">
          R
        </span>
        <span className="absolute -bottom-0.5 -left-0.5 h-2 w-2 rounded-full bg-accent-gold shadow-[0_0_8px] shadow-accent-gold/60" />
      </div>
      <span className="font-display text-lg font-extrabold tracking-tight text-foreground">
        RemoteStart
        <span className="text-accent-gold">-DZ</span>
      </span>
    </div>
  )
}
