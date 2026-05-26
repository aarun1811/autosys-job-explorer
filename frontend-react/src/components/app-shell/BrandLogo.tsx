import { useTheme } from '@/components/layout/theme-provider'
import logoLight from '@/assets/rectrace.png'
import logoDark from '@/assets/rectrace-dark.png'

/**
 * BrandLogo — theme-aware Rectrace mark (Angular logoPath swap parity).
 * Imported assets let Vite rewrite the URL for the configured base path
 * (`/rectrace/` in production). NOTE: the two source images are currently
 * byte-identical (as in the Angular app); the swap is wired for when they
 * diverge.
 */
export function BrandLogo({ className }: { className?: string }) {
  const { resolvedTheme } = useTheme()
  const src = resolvedTheme === 'dark' ? logoDark : logoLight
  return <img src={src} alt="Rectrace" className={className} />
}
