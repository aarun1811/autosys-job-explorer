import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UserChip } from '@/components/app-shell/UserChip'

describe('UserChip', () => {
  test('shows initials when identified', () => {
    render(<UserChip loginId="john.doe" initials="JD" isIdentified />)
    expect(screen.getByText('JD')).toBeInTheDocument()
    expect(screen.queryByText('Sign in')).not.toBeInTheDocument()
  })

  test('chip exposes the full loginId as a title (tooltip)', () => {
    render(<UserChip loginId="john.doe" initials="JD" isIdentified />)
    expect(screen.getByText('JD').getAttribute('title')).toBe('john.doe')
  })

  test('shows Sign in when not identified', () => {
    render(<UserChip loginId={null} initials="" isIdentified={false} />)
    expect(screen.getByText('Sign in')).toBeInTheDocument()
  })
})
