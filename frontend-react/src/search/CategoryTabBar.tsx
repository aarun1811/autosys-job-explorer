import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { m } from 'motion/react'
import { LayoutDashboardIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import type { CategoryResultV4 } from '@/search/types'

/**
 * CategoryTabBar — data-driven multi-tab strip below the header (Angular
 * `search-v5` tabs parity). One tab per result category, showing the label and
 * a small count pill (`<count>` or `<count>+` when `hasMore`). The active tab is
 * highlighted by a sliding underline that animates between tabs via a
 * shared-element `layoutId`. Clicking a tab calls `onSelect(key)`; the parent
 * writes it to the URL `tab` param.
 *
 * Overflow is premium, not raw: when the tabs are wider than the strip the
 * native scrollbar is hidden and replaced with soft edge fade-masks that appear
 * ONLY on the side(s) with more tabs (Linear/Chrome style), and the active tab
 * is kept scrolled into view. Nothing is hardcoded — labels, counts, and order
 * come from the `searchResults` array the parent derives from `/initial`.
 */
export interface CategoryTabBarProps {
  categories: CategoryResultV4[]
  activeKey: string
  onSelect: (key: string) => void
}

const FADE = '36px'

export function CategoryTabBar({ categories, activeKey, onSelect }: CategoryTabBarProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [edges, setEdges] = useState<{ left: boolean; right: boolean }>({ left: false, right: false })

  const recomputeEdges = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const left = el.scrollLeft > 1
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }))
  }, [])

  // Track overflow on mount, on scroll, on resize, and whenever the tab set changes.
  useLayoutEffect(() => {
    recomputeEdges()
    const el = scrollerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(recomputeEdges)
    ro.observe(el)
    return () => ro.disconnect()
  }, [recomputeEdges, categories])

  // Keep the active tab visible — clicking one near the clipped edge scrolls it in.
  useEffect(() => {
    const el = scrollerRef.current
    const active = el?.querySelector<HTMLElement>('[data-active="true"]')
    active?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
    recomputeEdges()
  }, [activeKey, recomputeEdges])

  // Chevron affordance — scroll roughly one "page" of tabs in either direction.
  const scrollByStep = useCallback((dir: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.72, behavior: 'smooth' })
  }, [])

  // Build the fade mask from current overflow state (omit entirely when neither
  // edge overflows, so fully-visible strips aren't clipped).
  const maskImage = (() => {
    if (!edges.left && !edges.right) return undefined
    const start = edges.left ? `transparent 0, #000 ${FADE}` : '#000 0'
    const end = edges.right ? `#000 calc(100% - ${FADE}), transparent 100%` : '#000 100%'
    return `linear-gradient(to right, ${start}, ${end})`
  })()

  return (
    <div className="relative border-b border-border/70">
      {edges.left && (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={() => scrollByStep(-1)}
          className="absolute left-1 top-1/2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-background/85 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronLeftIcon className="size-4" />
        </button>
      )}
      {edges.right && (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={() => scrollByStep(1)}
          className="absolute right-1 top-1/2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-background/85 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronRightIcon className="size-4" />
        </button>
      )}
      <div
        ref={scrollerRef}
        role="tablist"
        aria-label="Search result categories"
        onScroll={recomputeEdges}
        style={maskImage ? { WebkitMaskImage: maskImage, maskImage } : undefined}
        className="rectrace-no-scrollbar flex h-11 items-center gap-1 overflow-x-auto px-3"
      >
        {categories.map((c) => {
        const active = c.key === activeKey
        const isDashboard = c.columns.length === 0 && c.dashboard != null
        return (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={active}
            data-tab-key={c.key}
            data-active={active}
            onClick={() => onSelect(c.key)}
            className={`group relative flex h-11 shrink-0 items-center gap-2 rounded-md px-3 text-[13px] whitespace-nowrap outline-none transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
              active
                ? 'font-semibold text-foreground'
                : 'font-medium text-muted-foreground hover:text-foreground'
            }`}
          >
            {c.label}
            {isDashboard ? (
              <LayoutDashboardIcon
                data-testid="tab-dashboard-icon"
                className={`size-3.5 ${active ? 'text-primary' : 'text-muted-foreground/70'}`}
                aria-hidden
              />
            ) : (
              <span
                className={`rectrace-num inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none transition-colors ${
                  active
                    ? 'bg-primary/12 text-primary'
                    : 'bg-muted text-muted-foreground group-hover:bg-accent'
                }`}
              >
                {c.count}{c.hasMore ? '+' : ''}
              </span>
            )}
            {active && (
              <m.span
                aria-hidden
                layoutId="cat-tab-underline"
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
          </button>
          )
        })}
      </div>
    </div>
  )
}
