import { cn } from 'cn'
import { isStatus, STATUS_STYLE } from '@/lib/status'

export function PedidoStatusBadge({ status, className }: { status: string; className?: string }) {
  const estilo = isStatus(status) ? STATUS_STYLE[status].badge : 'bg-muted text-muted-foreground ring-1 ring-border'
  const dot = isStatus(status) ? STATUS_STYLE[status].dot : 'bg-muted-foreground'
  return (
    <span className={cn('inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium', estilo, className)}>
      <span className={cn('size-1.5 rounded-full', dot)} />
      {status}
    </span>
  )
}
