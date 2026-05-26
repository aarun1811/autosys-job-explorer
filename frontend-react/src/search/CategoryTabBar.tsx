import type { CategoryResultV4 } from '@/search/types'

/**
 * CategoryTabBar — data-driven multi-tab strip below the header (Angular
 * `search-v5` tabs parity). One tab per result category, labelled
 * `"<label> (<count>)"` (or `"(<count>+)"` when `hasMore`). The active tab
 * carries a 2px bottom border in `var(--primary)`. Clicking a tab calls
 * `onSelect(key)`; the parent writes it to the URL `tab` param.
 *
 * Nothing is hardcoded — labels, counts, and order all come from the
 * `searchResults` array the parent derives from `/initial`.
 */
export interface CategoryTabBarProps {
  categories: CategoryResultV4[]
  activeKey: string
  onSelect: (key: string) => void
}

function tabLabel(c: CategoryResultV4): string {
  return `${c.label} (${c.count}${c.hasMore ? '+' : ''})`
}

export function CategoryTabBar({ categories, activeKey, onSelect }: CategoryTabBarProps) {
  return (
    <div className="flex items-center gap-0 border-b px-4 h-10 bg-muted/50 backdrop-blur-sm overflow-x-auto">
      {categories.map((c) => {
        const active = c.key === activeKey
        return (
          <button
            key={c.key}
            type="button"
            data-tab-key={c.key}
            data-active={active}
            onClick={() => onSelect(c.key)}
            className={`px-4 h-10 flex items-center text-xs font-semibold whitespace-nowrap border-b-2 ${
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tabLabel(c)}
          </button>
        )
      })}
    </div>
  )
}
