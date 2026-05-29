import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { GridNoRowsOverlay } from '@/search/GridNoRowsOverlay'

describe('GridNoRowsOverlay', () => {
  test('renders a calm, helpful no-rows message', () => {
    render(<GridNoRowsOverlay />)
    expect(screen.getByText(/no rows/i)).toBeInTheDocument()
  })
})
