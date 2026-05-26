import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MotionProvider } from '@/components/layout/motion-provider'

describe('MotionProvider', () => {
  it('renders its children', () => {
    render(<MotionProvider><span>hi</span></MotionProvider>)
    expect(screen.getByText('hi')).toBeInTheDocument()
  })
})
