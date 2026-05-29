import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { NoResultsState } from '@/search/NoResultsState'

function setup(props?: Partial<React.ComponentProps<typeof NoResultsState>>) {
  const onExample = vi.fn()
  const onClear = vi.fn()
  render(
    <NoResultsState
      term={props?.term ?? 'HMC'}
      examples={props?.examples ?? ['reconour', 'gpdw', 'flexcube']}
      searchableCategories={props?.searchableCategories ?? ['job name', 'set ID']}
      onExample={onExample}
      onClear={onClear}
      {...props}
    />,
  )
  return { onExample, onClear }
}

describe('NoResultsState', () => {
  test('shows the heading and echoes the searched term', () => {
    setup({ term: 'HMC' })
    expect(screen.getByText('No results found')).toBeInTheDocument()
    expect(screen.getByText('HMC')).toBeInTheDocument()
  })

  test('offers genuinely-helpful suggestions (spelling + what is searchable)', () => {
    setup({ searchableCategories: ['job name', 'set ID', 'recon name'] })
    expect(screen.getByText(/check the spelling/i)).toBeInTheDocument()
    // The searchable-categories line lists what the user can search by.
    expect(screen.getByText(/job name/)).toBeInTheDocument()
  })

  test('renders example chips under a "Browse examples" label and fires onExample', () => {
    const { onExample } = setup({ examples: ['reconour', 'gpdw'] })
    expect(screen.getByText(/browse examples/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'reconour' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'gpdw' }))
    expect(onExample).toHaveBeenCalledWith('gpdw')
  })

  test('Start over action fires onClear', () => {
    const { onClear } = setup()
    fireEvent.click(screen.getByRole('button', { name: /Start over/i }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
