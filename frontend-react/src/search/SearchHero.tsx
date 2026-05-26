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
import { useState } from 'react'

/**
 * SearchHero — the centered landing page at `/`. Atmospheric aura backdrop,
 * a large brand logo, and the elevated `hero` SearchBar whose placeholder rolls
 * its trailing category word ("Search by job name" → "set ID" → …). Submitting
 * navigates to `/search?q=…`. Motion is gated by prefers-reduced-motion.
 */
export function SearchHero(): React.ReactElement {
  const navigate = useNavigate()
  const user = useUserInfo()
  const [value, setValue] = useState('')
  const suggestions = useSuggestions(value)

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

      <main className="-mt-12 flex flex-1 flex-col items-center justify-center px-4">
        <div className="flex w-full max-w-2xl flex-col items-center">
          <BrandLogo className="h-20 w-auto animate-in fade-in-0 zoom-in-95 fill-mode-both duration-700 [animation-delay:60ms]" />

          <div className="mt-10 w-full animate-in fade-in-0 slide-in-from-bottom-3 fill-mode-both duration-700 [animation-delay:200ms]">
            <SearchBar
              variant="hero"
              value={value}
              onChange={setValue}
              onSubmit={submit}
              onClear={() => setValue('')}
              suggestions={suggestions}
              rollingPlaceholder={{ prefix: 'Search by', words: PLACEHOLDER_PHRASES }}
            />
          </div>

          <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground animate-in fade-in-0 fill-mode-both duration-700 [animation-delay:340ms]">
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
