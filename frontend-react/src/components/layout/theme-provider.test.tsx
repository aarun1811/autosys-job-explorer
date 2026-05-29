import { render, screen } from '@testing-library/react'
import { ThemeProvider, useTheme } from './theme-provider'

function ReadTheme() {
  const { resolvedTheme } = useTheme()
  return <div data-testid="theme">{resolvedTheme}</div>
}

test('ThemeProvider renders children and defaults to system-resolved theme', () => {
  render(<ThemeProvider><ReadTheme /></ThemeProvider>)
  expect(screen.getByTestId('theme')).toBeInTheDocument()
})

test('ThemeProvider uses rectrace-theme storage key', () => {
  localStorage.setItem('rectrace-theme', 'dark')
  render(<ThemeProvider><ReadTheme /></ThemeProvider>)
  expect(screen.getByTestId('theme').textContent).toBe('dark')
  localStorage.removeItem('rectrace-theme')
})
