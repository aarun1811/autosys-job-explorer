import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/app-shell/BrandLogo'
import { UserChip } from '@/components/app-shell/UserChip'
import { ThemeSwitch } from '@/components/layout/theme-switch'
import { SearchBar } from '@/search/SearchBar'
import { useSuggestions } from '@/search/hooks/useSuggestions'
import { useUserInfo } from '@/search/hooks/useUserInfo'
import { PLACEHOLDER_PHRASES, TRY_EXAMPLES } from '@/search/lib/heroContent'

/**
 * SearchHero — the centered landing page at `/` (Angular pre-search hero parity,
 * shadcn shell). Logo + a rotating-placeholder search input + Search + Try,
 * with the theme switch and user chip top-right. Submitting navigates to
 * `/search?q=<term>` (the results view).
 *
 * The placeholder phrase rotates every 2.2s (honoring prefers-reduced-motion);
 * the richer animated-label treatment is deferred to the polish pass.
 */
export function SearchHero(): React.ReactElement {
  const navigate = useNavigate()
  const user = useUserInfo()
  const [value, setValue] = useState('')
  const suggestions = useSuggestions(value)
  const [phraseIdx, setPhraseIdx] = useState(0)
  const reduced = useRef(false)

  useEffect(() => {
    reduced.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (reduced.current) return
    const id = setInterval(() => setPhraseIdx((i) => (i + 1) % PLACEHOLDER_PHRASES.length), 2200)
    return () => clearInterval(id)
  }, [])

  const submit = (term: string) => {
    const t = term.trim()
    if (t) void navigate({ to: '/search', search: { q: t } })
  }
  const tryRandom = () => submit(TRY_EXAMPLES[Math.floor(Math.random() * TRY_EXAMPLES.length)])

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-end gap-2 px-4 py-2">
        <ThemeSwitch />
        <UserChip {...user} />
      </header>
      <main className="-mt-16 flex flex-1 flex-col items-center justify-center gap-6 px-4">
        <BrandLogo className="h-12 w-auto" />
        <div className="w-full max-w-xl">
          <SearchBar
            value={value}
            onChange={setValue}
            onSubmit={submit}
            onClear={() => setValue('')}
            suggestions={suggestions}
            placeholder={`Search by ${PLACEHOLDER_PHRASES[phraseIdx]}…`}
          />
          <div className="mt-3 flex justify-center">
            <Button type="button" variant="ghost" size="sm" onClick={tryRandom}>
              Try an example
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
