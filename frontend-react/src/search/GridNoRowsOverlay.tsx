import { SearchXIcon } from 'lucide-react'

/** AG-Grid noRowsOverlayComponent — shown when a category/filter yields zero rows. */
export function GridNoRowsOverlay() {
  return (
    <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
      <span className="flex size-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
        <SearchXIcon className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <p className="font-semibold tracking-tight text-foreground">No rows to show</p>
      <p className="text-xs text-muted-foreground">Try clearing filters or refining your search.</p>
    </div>
  )
}
