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
      <DialogContent className="flex h-[90vh] w-[95vw] max-w-[1600px] sm:max-w-[1600px] flex-col gap-0 overflow-hidden p-0">
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
