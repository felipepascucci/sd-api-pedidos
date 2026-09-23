import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, RefreshCw } from 'lucide-react'
import { cn } from 'cn'
import { PedidoStatusBadge } from '@/components/PedidoStatusBadge'
import { RequestResponsePanel } from '@/components/RequestResponsePanel'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { formatBRL, formatDateTime } from '@/lib/format'
import type { HttpResult } from '@/lib/http'
import { pedidosApi, type Pedido } from '@/lib/pedidos-api'
import { STATUS, STATUS_STYLE, transicaoPermitida } from '@/lib/status'

interface Props {
  pedidoId: number | null
  onClose: () => void
}

export function PedidoDetalheSheet({ pedidoId, onClose }: Props) {
  const queryClient = useQueryClient()
  const [consulta, setConsulta] = useState<HttpResult<Pedido> | null>(null)
  const [ultimaAcao, setUltimaAcao] = useState<HttpResult<Pedido> | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [alterando, setAlterando] = useState<string | null>(null)

  const carregar = async (id: number) => {
    setCarregando(true)
    setConsulta(await pedidosApi.consultar(id))
    setCarregando(false)
  }

  useEffect(() => {
    setUltimaAcao(null)
    setConsulta(null)
    if (pedidoId !== null) void carregar(pedidoId)
  }, [pedidoId])

  const pedido = consulta?.ok ? consulta.body : null

  const alterar = async (status: string) => {
    if (!pedido) return
    setAlterando(status)
    const r = await pedidosApi.alterarStatus(pedido.id, { status }, { toast: { success: `Status alterado para ${status}` } })
    setAlterando(null)
    setUltimaAcao(r)
    if (r.ok && r.body) {
      setConsulta({ ...consulta!, body: r.body })
      void queryClient.invalidateQueries({ queryKey: ['pedidos'] })
    }
  }

  return (
    <Sheet open={pedidoId !== null} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Pedido <span className="font-mono">#{pedidoId}</span>
            {pedido && <PedidoStatusBadge status={pedido.status} />}
          </SheetTitle>
          <SheetDescription>
            Dados obtidos agora por <code className="text-xs">GET /pedidos/{pedidoId}</code> (chamada registrada no histórico).
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4 pb-6">
          {carregando && !consulta ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : pedido ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Cliente</dt>
              <dd className="break-all">{pedido.cliente}</dd>
              <dt className="text-muted-foreground">Produto</dt>
              <dd className="break-all">{pedido.produto}</dd>
              <dt className="text-muted-foreground">Quantidade</dt>
              <dd className="font-mono">{pedido.quantidade}</dd>
              <dt className="text-muted-foreground">Valor unitário</dt>
              <dd className="font-mono">{formatBRL(pedido.valor_unitario)}</dd>
              <dt className="text-muted-foreground">Valor total</dt>
              <dd className="font-mono font-semibold">{formatBRL(pedido.valor_total)}</dd>
              <dt className="text-muted-foreground">Criado em</dt>
              <dd>{formatDateTime(pedido.data_criacao)}</dd>
            </dl>
          ) : consulta ? (
            <RequestResponsePanel result={consulta} />
          ) : null}

          {pedido && (
            <>
              <Separator />
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Alterar status</p>
                  <Button variant="ghost" size="xs" onClick={() => carregar(pedido.id)} disabled={carregando}>
                    <RefreshCw className={cn(carregando && 'animate-spin')} />
                    Recarregar
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {STATUS.map((s) => {
                    const permitido = transicaoPermitida(pedido.status, s)
                    return (
                      <Button
                        key={s}
                        variant={permitido ? 'default' : 'outline'}
                        className={cn('h-auto flex-col gap-0.5 py-2', permitido && STATUS_STYLE[s].badge, permitido && 'hover:brightness-110')}
                        onClick={() => alterar(s)}
                        disabled={alterando !== null}
                      >
                        <span className="flex items-center gap-1.5">
                          {alterando === s && <Loader2 className="animate-spin" />}
                          {s}
                        </span>
                        <span className="text-[10px] font-normal opacity-80">{permitido ? 'permitido · 200' : 'esperado: 409'}</span>
                      </Button>
                    )
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Os botões em destaque são as transições permitidas a partir de <strong>{pedido.status}</strong>. Os demais ficam disponíveis para você ver o erro da API.
                </p>
              </div>
            </>
          )}

          {ultimaAcao && (
            <>
              <Separator />
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Última ação</p>
                <RequestResponsePanel result={ultimaAcao} bodyMaxHeight="16rem" />
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
