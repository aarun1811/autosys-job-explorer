import { m } from 'motion/react'
import { LayoutDashboardIcon } from 'lucide-react'

import type { CategoryResultV4 } from '@/search/types'

/**
 * CategoryTabBar — data-driven multi-tab strip below the header (Angular
 * `search-v5` tabs parity). One tab per result category, showing the label and
 * a small muted count pill (`<count>` or `<count>+` when `hasMore`). The active
 * tab is highlighted by a sliding underline that animates between tabs via a
 * shared-element `layoutId`. Clicking a tab calls `onSelect(key)`; the parent
 * writes it to the URL `tab` param.
 *
 * Nothing is hardcoded — labels, counts, and order all come from the
 * `searchResults` array the parent derives from `/initial`.
 */
export interface CategoryTabBarProps {
  categories: CategoryResultV4[]
  activeKey: string
  onSelect: (key: string) => void
}

export function CategoryTabBar({ categories, activeKey, onSelect }: CategoryTabBarProps) {
  return (
    <div
      role="tablist"
      aria-label="Search result categories"
      className="flex items-center gap-0.5 border-b px-4 h-10 bg-muted/40 backdrop-blur-md overflow-x-auto"
    >
      {categories.map((c) => {
        const active = c.key === activeKey
        return (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={active}
            data-tab-key={c.key}
            data-active={active}
            onClick={() => onSelect(c.key)}
            className={`relative px-3.5 h-10 flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap transition-colors duration-200 ease-out rounded-t-md ${
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
            }`}
          >
            {c.label}
            {c.columns.length === 0 && c.dashboard != null ? (
              <LayoutDashboardIcon data-testid="tab-dashboard-icon" className="size-3.5 text-muted-foreground" aria-hidden />
            ) : (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                {c.count}{c.hasMore ? '+' : ''}
              </span>
            )}
            {active && (
              <m.span
                aria-hidden
                layoutId="cat-tab-underline"
                className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-primary"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
