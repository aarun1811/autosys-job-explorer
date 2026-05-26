import type { ReactNode } from 'react'
import { LazyMotion, domAnimation, MotionConfig } from 'motion/react'

/**
 * App-wide Motion config. `reducedMotion="user"` honours the OS setting
 * (disables transforms, keeps opacity) — WCAG-friendly with zero per-component
 * work. LazyMotion + domAnimation keeps the bundle lean; components use `m.*`
 * (from 'motion/react'), never the full `motion.*`.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  )
}
