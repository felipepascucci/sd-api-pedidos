import type { ReactNode } from 'react'
import { Clock, HardDrive, Timer } from 'lucide-react'
import { cn } from 'cn'
import { CopyButton } from '@/components/CopyButton'
import { HttpStatusBadge, MethodLabel } from '@/components/HttpStatusBadge'
import { JsonViewer } from '@/components/JsonViewer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toCurl } from '@/lib/curl'
import { formatBytes, formatDateTime, formatDuration } from '@/lib/format'
import type { HttpResult } from '@/lib/http'

function corpoEnviado(raw: string | null): unknown {
  if (raw === null) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

interface Props {
  result: HttpResult
  actions?: ReactNode
  className?: string
  bodyMaxHeight?: string
}

export function RequestResponsePanel({ result, actions, className, bodyMaxHeight }: Props) {
  const headers = Object.entries(result.responseHeaders).sort(([a], [b]) => a.localeCompare(b))
  const curl = toCurl({ origem: result.origem, method: result.method, path: result.path, body: result.requestBody })

  return (
    <div className={cn('flex min-w-0 flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <HttpStatusBadge status={result.status} statusText={result.statusText} unavailable={result.unavailable} />
        <div className="flex min-w-0 items-center gap-1.5">
          <MethodLabel method={result.method} />
          <code className="truncate text-xs">{result.url}</code>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1" title="Tempo de resposta">
            <Timer className="size-3.5" />
            {formatDuration(result.durationMs)}
          </span>
          <span className="inline-flex items-center gap-1" title="Tamanho da resposta">
            <HardDrive className="size-3.5" />
            {formatBytes(result.size)}
          </span>
          <span className="inline-flex items-center gap-1" title="Horário">
            <Clock className="size-3.5" />
            {formatDateTime(result.timestamp)}
          </span>
        </div>
        {actions && <div className="ml-auto flex items-center gap-1.5">{actions}</div>}
      </div>

      {result.error && (
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-700 dark:text-violet-300">
          {result.error}
        </div>
      )}

      <Tabs defaultValue="resposta" className="min-w-0">
        <TabsList>
          <TabsTrigger value="resposta">Resposta</TabsTrigger>
          <TabsTrigger value="headers">Headers ({headers.length})</TabsTrigger>
          <TabsTrigger value="requisicao">Requisição</TabsTrigger>
        </TabsList>
        <TabsContent value="resposta">
          <JsonViewer value={result.isJson ? result.body : result.rawBody} maxHeight={bodyMaxHeight} />
        </TabsContent>
        <TabsContent value="headers">
          {headers.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem headers (a requisição não obteve resposta).</p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-xs">
                <tbody>
                  {headers.map(([k, v]) => (
                    <tr
                      key={k}
                      className={cn('border-b last:border-0', k === 'location' && 'bg-emerald-500/10 font-medium')}
                    >
                      <td className="w-1/3 px-3 py-1.5 font-mono text-muted-foreground">{k}</td>
                      <td className="px-3 py-1.5 font-mono break-all">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="requisicao" className="flex flex-col gap-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Corpo enviado</p>
            <JsonViewer value={corpoEnviado(result.requestBody)} maxHeight="14rem" />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Equivalente em curl</p>
              <CopyButton text={curl} label="Copiar curl" />
            </div>
            <JsonViewer value={curl} copy={false} maxHeight="10rem" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
