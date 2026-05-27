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

  test('renders the order/color honesty hint', () => {
    render(<StatusLegend />)
    expect(screen.getByTestId('eo-order-hint')).toHaveTextContent(/execution order/i)
    expect(screen.getByTestId('eo-order-hint')).toHaveTextContent(/last run/i)
  })
})
