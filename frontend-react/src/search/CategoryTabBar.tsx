/**
 * CategoryTabBar — single non-interactive tab strip immediately below the header.
 *
 * Phase 3 renders exactly one tab ("File Name") because the vertical slice is
 * single-category. The component exists to:
 *   1. Show the active category label to the user.
 *   2. Establish the markup/sizing pattern for Phase 4+ when multiple categories
 *      will render and a tab-switching primitive (shadcn Tabs) will replace the
 *      static span.
 *
 * UI-SPEC §"Category Tab Bar":
 *   - Background: bg-muted/50 backdrop-blur-sm (matches Phase 2 header translucency)
 *   - Height: 40px (`h-10`)
 *   - Active tab: 2px bottom border in var(--primary) (`border-b-2 border-primary`)
 *   - Label: 12px semibold (`text-xs font-semibold`)
 *
 * TODO(Phase 4): replace this with shadcn Tabs over multi-category config.
 * Phase 4 will grep for this exact "TODO(Phase 4)" marker.
 */
export interface CategoryTabBarProps {
  activeCat: string
  // Phase 3: single tab; no onChange handler yet (no switching).
}

const CATEGORY_LABELS: Record<string, string> = {
  fileName: 'File Name',
}

export function CategoryTabBar({ activeCat }: CategoryTabBarProps) {
  const label = CATEGORY_LABELS[activeCat] ?? 'File Name'
  return (
    <div className="flex items-center gap-0 border-b px-4 h-10 bg-muted/50 backdrop-blur-sm">
      <div
        data-active-cat={activeCat}
        className="px-4 h-10 flex items-center text-xs font-semibold border-b-2 border-primary"
      >
        {label}
      </div>
    </div>
  )
}
