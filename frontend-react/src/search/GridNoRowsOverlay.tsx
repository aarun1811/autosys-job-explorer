import { SearchXIcon } from 'lucide-react'

/** AG-Grid noRowsOverlayComponent — shown when a category/filter yields zero rows. */
export function GridNoRowsOverlay() {
  return (
    <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
      <SearchXIcon className="size-7 opacity-70" />
      <p className="font-medium text-foreground">No rows to show</p>
      <p className="text-xs">Try clearing filters or refining your search.</p>
    </div>
  )
}
