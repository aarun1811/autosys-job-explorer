export function Footer() {
  return (
    <footer className="flex items-center gap-2 border-t border-border/70 px-5 py-2 text-[11px] text-muted-foreground">
      <span className="font-semibold tracking-tight text-foreground/70">Rectrace</span>
      <span className="text-border">·</span>
      <span className="font-mono text-muted-foreground/80">{__BUILD_SHA__}</span>
      <span className="text-border">·</span>
      <span className="font-mono text-muted-foreground/80">v0.1.0</span>
    </footer>
  )
}
