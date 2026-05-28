import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { RecvizEmbed } from '@/search/RecvizEmbed'

export interface RecvizDashboardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  url: string
}

export function RecvizDashboardModal({ open, onOpenChange, title, url }: RecvizDashboardModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] w-[min(95vw,1100px)] max-w-[min(95vw,1100px)] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">Embedded RecViz dashboard</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1">
          <RecvizEmbed url={url} q="" title={title} fillContainer />
        </div>
      </DialogContent>
    </Dialog>
  )
}
