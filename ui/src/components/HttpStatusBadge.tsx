import { cn } from 'cn'

export function httpStatusClasse(status: number | null, unavailable = false): string {
  if (status === null || unavailable) return 'bg-violet-500/15 text-violet-600 dark:text-violet-300 ring-violet-500/30'
  if (status >= 500) return 'bg-red-500/15 text-red-600 dark:text-red-400 ring-red-500/30'
  if (status >= 400) return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30'
  if (status >= 200 && status < 300) return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30'
  return 'bg-muted text-muted-foreground ring-border'
}

interface Props {
  status: number | null
  statusText?: string
  unavailable?: boolean
  className?: string
}

export function HttpStatusBadge({ status, statusText, unavailable, className }: Props) {
  const texto = status === null ? 'REDE' : unavailable ? `${status} indisponível` : `${status}${statusText ? ` ${statusText}` : ''}`
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-md px-1.5 font-mono text-[11px] font-medium whitespace-nowrap ring-1',
        httpStatusClasse(status, unavailable),
        className,
      )}
    >
      {texto}
    </span>
  )
}

const METODO_CLASSE: Record<string, string> = {
  GET: 'text-sky-600 dark:text-sky-400',
  POST: 'text-emerald-600 dark:text-emerald-400',
  PATCH: 'text-amber-600 dark:text-amber-400',
  PUT: 'text-orange-600 dark:text-orange-400',
  DELETE: 'text-red-600 dark:text-red-400',
}

export function MethodLabel({ method, className }: { method: string; className?: string }) {
  return <span className={cn('font-mono text-[11px] font-semibold', METODO_CLASSE[method], className)}>{method}</span>
}
