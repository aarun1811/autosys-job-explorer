import { m, AnimatePresence } from 'motion/react'
import { ChevronDownIcon, LinkIcon } from 'lucide-react'
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
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
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

export function DashboardPanel({ variant, dashboard, q, open, onOpenChange }: DashboardPanelProps) {
  if (variant === 'full') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-semibold text-foreground">{dashboard.title ?? 'Dashboard'}</span>
          <CopyLink />
        </div>
        <div className="min-h-0 flex-1 px-3 pb-3">
          <RecvizEmbed url={dashboard.url} q={q} title={dashboard.title ?? undefined} minHeight={dashboard.height ?? 320} />
        </div>
      </div>
    )
  }
  return (
    <div className="border-b">
      <div className="flex items-center justify-between px-3 py-1.5">
        <button
          type="button"
          aria-label={open ? 'Collapse dashboard' : 'Expand dashboard'}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground"
          onClick={() => onOpenChange(!open)}
        >
          <m.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.18 }} className="inline-flex">
            <ChevronDownIcon className="size-4" />
          </m.span>
          {dashboard.title ?? 'Dashboard'}
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
