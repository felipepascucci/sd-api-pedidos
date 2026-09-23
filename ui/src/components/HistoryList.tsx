import { cn } from 'cn'
import { HttpStatusBadge, MethodLabel } from '@/components/HttpStatusBadge'
import { formatDuration, formatTime } from '@/lib/format'
import type { HttpResult } from '@/lib/http'

export function OrigemBadge({ origem }: { origem: HttpResult['origem'] }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded px-1.5 text-[10px] font-medium tracking-wide uppercase',
        origem === 'api' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' : 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400',
      )}
    >
      {origem === 'api' ? 'API' : 'Inspetor'}
    </span>
  )
}

interface Props {
  entries: HttpResult[]
  selectedId?: string | null
  onSelect?: (entry: HttpResult) => void
}

export function HistoryList({ entries, selectedId, onSelect }: Props) {
  return (
    <ul className="divide-y">
      {entries.map((e) => (
        <li key={e.id}>
          <button
            type="button"
            onClick={() => onSelect?.(e)}
            className={cn(
              'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/50',
              selectedId === e.id && 'bg-muted',
            )}
          >
            <span className="w-16 shrink-0 font-mono text-[11px] text-muted-foreground">{formatTime(e.timestamp)}</span>
            <span className="hidden w-16 shrink-0 sm:block">
              <OrigemBadge origem={e.origem} />
            </span>
            <MethodLabel method={e.method} className="w-12 shrink-0" />
            <code className="min-w-0 flex-1 truncate text-xs">{e.path}</code>
            <HttpStatusBadge status={e.status} unavailable={e.unavailable} />
            <span className="hidden w-14 shrink-0 text-right font-mono text-[11px] text-muted-foreground sm:block">
              {formatDuration(e.durationMs)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
