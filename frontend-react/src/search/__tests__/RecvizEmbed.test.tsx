import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { act } from 'react'
import { resolveEmbedUrl, RecvizEmbed } from '@/search/RecvizEmbed'
import { ThemeProvider } from '@/components/layout/theme-provider'

describe('resolveEmbedUrl', () => {
  it('substitutes {q} encoded', () => {
    expect(resolveEmbedUrl('https://x/e?term={q}', 'a b')).toBe('https://x/e?term=a%20b')
  })
  it('leaves a url without {q} unchanged', () => {
    expect(resolveEmbedUrl('https://x/e', 'a')).toBe('https://x/e')
  })
})

function dispatchMessage(origin: string, data: unknown) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { origin, data }))
  })
}

describe('RecvizEmbed origin validation', () => {
  it('ignores height messages from a wrong origin, applies them from the embed origin', () => {
    const { container } = render(
      <ThemeProvider>
        <RecvizEmbed url="https://recviz.example/embed" q="x" minHeight={300} />
      </ThemeProvider>,
    )
    const iframe = container.querySelector('iframe')!
    dispatchMessage('https://evil.example', { type: 'RECTRACE_IFRAME_HEIGHT', height: 999 })
    expect(iframe.style.height).toBe('300px') // unchanged — wrong origin ignored
    dispatchMessage('https://recviz.example', { type: 'RECTRACE_IFRAME_HEIGHT', height: 640 })
    expect(iframe.style.height).toBe('640px') // applied — valid origin
  })
})
