export function Footer() {
  return (
    <footer className="border-t px-4 py-2 text-muted-foreground text-[12px] flex items-center">
      <span>Rectrace · Build: {__BUILD_SHA__} · v0.1.0</span>
    </footer>
  )
}
