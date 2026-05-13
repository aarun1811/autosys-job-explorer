import { createFileRoute } from '@tanstack/react-router'
import { SmokeGrid } from '@/grid/SmokeGrid'
import { ThemeSwitch } from '@/components/layout/theme-switch'
import { Footer } from '@/components/app-shell/footer'

export const Route = createFileRoute('/')({
  component: IndexPage,
})

function IndexPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header
        className="bg-background/40 sticky top-0 z-50 flex items-center justify-between px-4 border-b backdrop-blur-md"
        style={{ height: 'var(--header-height, 2.5rem)' }}
      >
        <span className="text-sm font-semibold">Rectrace</span>
        {/* future search slot — Phase 3 */}
        <div className="flex-1" />
        <ThemeSwitch />
      </header>
      <main className="flex-1 overflow-auto p-4">
        <SmokeGrid />
      </main>
      <Footer />
    </div>
  )
}
