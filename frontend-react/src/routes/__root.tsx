import { Outlet, createRootRoute, type ErrorComponentProps } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { AlertTriangle } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/layout/theme-provider'
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
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster richColors position="bottom-right" />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
