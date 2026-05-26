import { useEffect, useMemo, useRef, useState } from 'react'
import { m } from 'motion/react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/layout/theme-provider'

/** Substitute the optional `{q}` placeholder (URL-encoded). Exported for tests. */
// react-refresh/only-export-components: intentionally exported for unit tests;
// it's a pure helper, no React state, so Fast Refresh boundary is unaffected.
// eslint-disable-next-line react-refresh/only-export-components
export function resolveEmbedUrl(url: string, q: string): string {
  return url.includes('{q}') ? url.replaceAll('{q}', encodeURIComponent(q)) : url
}

export interface RecvizEmbedProps {
  url: string
  q: string
  title?: string
  minHeight?: number
}

export function RecvizEmbed({ url, q, title, minHeight = 320 }: RecvizEmbedProps) {
  const src = useMemo(() => resolveEmbedUrl(url, q), [url, q])
  const origin = useMemo(() => {
    try {
      return new URL(src).origin
    } catch {
      return ''
    }
  }, [src])
  const ref = useRef<HTMLIFrameElement>(null)
  const { resolvedTheme } = useTheme()
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [height, setHeight] = useState(minHeight)
  const [reloadKey, setReloadKey] = useState(0)

  // Height messages from the embed — strict origin validation; never '*'.
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (!origin || e.origin !== origin) return
      const data = e.data as { type?: string; height?: number }
      if (data?.type === 'RECTRACE_IFRAME_HEIGHT' && typeof data.height === 'number') {
        setHeight(Math.max(minHeight, data.height))
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [origin, minHeight])

  // Push theme to the embed once loaded and on theme change.
  useEffect(() => {
    if (state !== 'ready' || !origin) return
    ref.current?.contentWindow?.postMessage({ type: 'RECTRACE_THEME', theme: resolvedTheme }, origin)
  }, [state, resolvedTheme, origin])

  return (
    <div className="relative h-full w-full" style={{ minHeight }}>
      {state === 'loading' && <Skeleton className="absolute inset-2 rounded-lg" />}
      {state === 'error' ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
          <p>This dashboard could not be loaded.</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setState('loading')
              setReloadKey((k) => k + 1)
            }}
          >
            Retry
          </Button>
        </div>
      ) : (
        <m.iframe
          key={reloadKey}
          ref={ref}
          src={src}
          title={title ?? 'Dashboard'}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups-to-escape-sandbox"
          onLoad={() => setState('ready')}
          onError={() => setState('error')}
          initial={{ opacity: 0 }}
          animate={{ opacity: state === 'ready' ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          className="h-full w-full border-0"
          style={{ height }}
        />
      )}
    </div>
  )
}
