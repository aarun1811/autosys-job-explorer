import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { SparklesIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/app-shell/BrandLogo'
import { UserChip } from '@/components/app-shell/UserChip'
import { ThemeSwitch } from '@/components/layout/theme-switch'
import { SearchBar } from '@/search/SearchBar'
import { useSuggestions } from '@/search/hooks/useSuggestions'
import { useUserInfo } from '@/search/hooks/useUserInfo'
import { PLACEHOLDER_PHRASES, TRY_EXAMPLES } from '@/search/lib/heroContent'

/**
 * SearchHero — the centered landing page at `/`. Premium, atmospheric
 * treatment: a soft primary aura + dotted-grid backdrop, an orchestrated
 * staggered entrance (logo → tagline → search → actions), and the large
 * elevated `hero` SearchBar variant. Submitting navigates to `/search?q=…`.
 * All motion is gated by prefers-reduced-motion (see index.css).
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
    const id = setInterval(() => setPhraseIdx((i) => (i + 1) % PLACEHOLDER_PHRASES.length), 2600)
    return () => clearInterval(id)
  }, [])

  const submit = (term: string) => {
    const t = term.trim()
    if (t) void navigate({ to: '/search', search: { q: t } })
  }
  const tryRandom = () => submit(TRY_EXAMPLES[Math.floor(Math.random() * TRY_EXAMPLES.length)])

  return (
    <div className="rectrace-aura flex min-h-screen flex-col">
      <header className="flex items-center justify-end gap-2 px-5 py-3.5">
        <ThemeSwitch />
        <UserChip {...user} />
      </header>

      <main className="-mt-14 flex flex-1 flex-col items-center justify-center px-4">
        <div className="flex w-full max-w-2xl flex-col items-center">
          <BrandLogo className="h-14 w-auto animate-in fade-in-0 zoom-in-95 fill-mode-both duration-700 [animation-delay:60ms]" />

          <h1 className="mt-7 text-center text-2xl font-semibold tracking-tight text-foreground animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-700 [animation-delay:160ms] sm:text-3xl">
            Explore Autosys jobs &amp; reconciliations
          </h1>
          <p className="mt-2.5 max-w-md text-center text-sm text-muted-foreground animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-700 [animation-delay:240ms]">
            Trace job metadata, dependencies, and TLM stats across Oracle and Elasticsearch — all in one search.
          </p>

          <div className="mt-9 w-full animate-in fade-in-0 slide-in-from-bottom-3 fill-mode-both duration-700 [animation-delay:340ms]">
            <SearchBar
              variant="hero"
              value={value}
              onChange={setValue}
              onSubmit={submit}
              onClear={() => setValue('')}
              suggestions={suggestions}
              placeholder={`Search by ${PLACEHOLDER_PHRASES[phraseIdx]}…`}
            />
          </div>

          <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground animate-in fade-in-0 fill-mode-both duration-700 [animation-delay:460ms]">
            <span>Not sure where to start?</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={tryRandom}
              className="rounded-full transition-transform hover:-translate-y-0.5"
            >
              <SparklesIcon className="size-3.5 mr-1.5 text-primary" />
              Try an example
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
