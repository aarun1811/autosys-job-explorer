import { Outlet, createRootRoute, type ErrorComponentProps } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { AlertTriangle } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { MotionProvider } from '@/components/layout/motion-provider'
import { queryClient } from '@/lib/queryClient'

function RootErrorComponent({ error }: ErrorComponentProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <p className="font-medium">Something went wrong</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {error?.message || 'An unexpected error occurred.'}
      </p>
    </div>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: RootErrorComponent,
})

function RootLayout() {
  return (
    <ThemeProvider>
      <MotionProvider>
        <QueryClientProvider client={queryClient}>
          {/* Toaster must mount BEFORE any child that may dispatch toasts during
              its initial render — otherwise Sonner 2.x silently discards toasts
              queued before its Toaster consumer subscribes. SmokeGrid kicks off
              an SSRM fetch on mount and routes failures through toast.error;
              without this ordering, those very first errors never render. */}
          <Toaster richColors position="bottom-right" />
          <Outlet />
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </MotionProvider>
    </ThemeProvider>
  )
}
