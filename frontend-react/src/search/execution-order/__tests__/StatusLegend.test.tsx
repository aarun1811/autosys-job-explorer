import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusLegend } from '../StatusLegend'

describe('StatusLegend', () => {
  test('renders all five status labels', () => {
    render(<StatusLegend />)
    for (const label of ['Completed', 'Failed', 'Running', 'Waiting', 'Inactive']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })
})
