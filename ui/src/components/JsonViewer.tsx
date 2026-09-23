import { useMemo, type ReactNode } from 'react'
import { cn } from 'cn'
import { CopyButton } from '@/components/CopyButton'

const TOKEN = /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g

function classe(token: string): string {
  if (token.startsWith('"')) return token.trimEnd().endsWith(':') ? 'text-sky-600 dark:text-sky-300' : 'text-emerald-600 dark:text-emerald-300'
  if (token === 'true' || token === 'false') return 'text-violet-600 dark:text-violet-300'
  if (token === 'null') return 'text-muted-foreground italic'
  return 'text-amber-600 dark:text-amber-300'
}

function destacar(texto: string): ReactNode[] {
  const nos: ReactNode[] = []
  let ultimo = 0
  for (const m of texto.matchAll(TOKEN)) {
    const i = m.index ?? 0
    if (i > ultimo) nos.push(texto.slice(ultimo, i))
    nos.push(
      <span key={i} className={classe(m[0])}>
        {m[0]}
      </span>,
    )
    ultimo = i + m[0].length
  }
  if (ultimo < texto.length) nos.push(texto.slice(ultimo))
  return nos
}

interface Props {
  /** Valor a exibir. Strings são mostradas como texto cru (não JSON). */
  value: unknown
  className?: string
  maxHeight?: string
  copy?: boolean
}

export function JsonViewer({ value, className, maxHeight = '28rem', copy = true }: Props) {
  const { texto, json } = useMemo(() => {
    if (value === undefined) return { texto: '', json: false }
    if (typeof value === 'string') return { texto: value, json: false }
    return { texto: JSON.stringify(value, null, 2), json: true }
  }, [value])

  if (!texto) {
    return <div className={cn('rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground', className)}>(vazio)</div>
  }

  return (
    <div className={cn('group relative rounded-lg border bg-muted/30', className)}>
      {copy && (
        <div className="absolute top-1.5 right-1.5 opacity-60 transition-opacity group-hover:opacity-100">
          <CopyButton text={texto} />
        </div>
      )}
      <pre className="overflow-auto p-3 pr-10 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all" style={{ maxHeight }}>
        {json ? destacar(texto) : texto}
      </pre>
    </div>
  )
}
