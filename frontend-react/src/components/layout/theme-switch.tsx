import { useState, useEffect } from 'react'
import { MoonIcon, SunIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from './theme-provider'

export function ThemeSwitch() {
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <Button
      size="icon-sm"
      variant="ghost"
      className="relative"
      onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
    >
      {resolvedTheme === 'light' ? <MoonIcon /> : <SunIcon />}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
