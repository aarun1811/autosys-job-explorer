import { m, AnimatePresence } from 'motion/react'
import { ChevronDownIcon, LinkIcon, LayoutDashboardIcon } from 'lucide-react'
import { toast } from 'sonner'
import { RecvizEmbed } from '@/search/RecvizEmbed'
import type { DashboardConfigV4 } from '@/search/types'

export interface DashboardPanelProps {
  variant: 'header' | 'full'
  dashboard: DashboardConfigV4
  q: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function CopyLink() {
  return (
    <button
      type="button"
      aria-label="Copy link to this view"
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      onClick={() => {
        navigator.clipboard
          .writeText(window.location.href)
          .then(() => toast.success('Link copied'))
          .catch(() => toast.error('Copy failed'))
      }}
    >
      <LinkIcon className="size-3.5" /> Copy link
    </button>
  )
}

/** Title with a leading dashboard glyph — shared by both variants. */
function DashboardTitle({ title }: { title?: string | null }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
      <span className="inline-flex size-6 items-center justify-center rounded-md bg-primary/12 text-primary">
        <LayoutDashboardIcon className="size-3.5" aria-hidden />
      </span>
      {title ?? 'Dashboard'}
    </span>
  )
}

export function DashboardPanel({ variant, dashboard, q, open, onOpenChange }: DashboardPanelProps) {
  if (variant === 'full') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-4 py-3">
          <DashboardTitle title={dashboard.title} />
          <CopyLink />
        </div>
        <div className="min-h-0 flex-1 px-4 pb-4">
          <RecvizEmbed url={dashboard.url} q={q} title={dashboard.title ?? undefined} minHeight={dashboard.height ?? 320} />
        </div>
      </div>
    )
  }
  return (
    <div className="border-b border-border/70">
      <div className="flex items-center justify-between px-4 py-2">
        <button
          type="button"
          aria-label={open ? 'Collapse dashboard' : 'Expand dashboard'}
          className="group inline-flex items-center gap-2 rounded-lg text-sm font-semibold tracking-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onOpenChange(!open)}
        >
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-primary/12 text-primary">
            <LayoutDashboardIcon className="size-3.5" aria-hidden />
          </span>
          {dashboard.title ?? 'Dashboard'}
          <m.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.18 }} className="inline-flex text-muted-foreground group-hover:text-foreground">
            <ChevronDownIcon className="size-4" />
          </m.span>
        </button>
        <CopyLink />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden px-3 pb-3"
          >
            <RecvizEmbed url={dashboard.url} q={q} title={dashboard.title ?? undefined} minHeight={dashboard.height ?? 320} />
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
