import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { useRecentSearches, RECENT_SEARCHES_KEY } from '@/search/hooks/useRecentSearches'

/**
 * Regression: `push` must not run side effects (localStorage write + the
 * cross-instance broadcast) inside the `setRecents` updater. Updaters run
 * during React's render phase; broadcasting there makes a *peer*
 * useRecentSearches instance call setState mid-render, which React reports as
 * "Cannot update a component while rendering a different component".
 *
 * We mount two consumers (mirroring SearchPage as the pusher + SearchBar as a
 * subscriber) and assert no such console.error is emitted when one pushes.
 */

// Pusher: only uses push(). Subscriber: only reads recents (subscribes via the
// hook's internal listener). Both share the localStorage-backed bucket.
function Pusher() {
  const { push } = useRecentSearches()
  return (
    <button type="button" onClick={() => push('trade')}>
      push
    </button>
  )
}
function Subscriber() {
  const { recents } = useRecentSearches()
  return <div data-testid="recents">{recents.join(',')}</div>
}

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('useRecentSearches render safety', () => {
  test('push does not trigger a setState-during-render warning across instances', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <>
        <Pusher />
        <Subscriber />
      </>,
    )
    fireEvent.click(screen.getByText('push'))

    const offending = errorSpy.mock.calls.find((args) =>
      args.some((a) => typeof a === 'string' && a.includes('Cannot update a component')),
    )
    expect(offending).toBeUndefined()
    // And the peer instance still reflects the pushed term + it persisted.
    expect(screen.getByTestId('recents').textContent).toContain('trade')
    expect(localStorage.getItem(RECENT_SEARCHES_KEY)).toContain('trade')
  })
})
