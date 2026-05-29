import type { ReactNode } from 'react'
import { LazyMotion, domMax, MotionConfig } from 'motion/react'

/**
 * App-wide Motion config. `reducedMotion="user"` honours the OS setting
 * (disables transforms, keeps opacity) — WCAG-friendly with zero per-component
 * work. LazyMotion + domMax keeps the bundle reasonably lean while bundling the
 * projection ("layout") feature that `layout`/`layoutId` require; components use
 * `m.*` (from 'motion/react'), never the full `motion.*`.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domMax} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  )
}
