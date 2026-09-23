import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Info, Loader2, Plus, XCircle } from 'lucide-react'
import { cn } from 'cn'
import { Callout, PageHeader } from '@/components/common'
import { PedidoStatusBadge } from '@/components/PedidoStatusBadge'
import { RequestResponsePanel } from '@/components/RequestResponsePanel'
import { StateMachineDiagram, type Tentativa } from '@/components/StateMachineDiagram'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { extractDetail, type HttpResult } from '@/lib/http'
import { pedidosApi, type Pedido } from '@/lib/pedidos-api'
import { usePedidos } from '@/lib/queries'
import { todasTransicoes, type StatusPedido } from '@/lib/status'

export function MaquinaEstadosPage() {
  const queryClient = useQueryClient()
  const pedidos = usePedidos()
  const lista = pedidos.data?.ok ? (pedidos.data.body ?? []) : []
  const [selecionadoId, setSelecionadoId] = useState<number | null>(null)
  const [tentativa, setTentativa] = useState<Tentativa | null>(null)
  const [ultimo, setUltimo] = useState<HttpResult<Pedido> | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const pedido = lista.find((p) => p.id === selecionadoId) ?? null

  const criarTeste = async () => {
    setOcupado(true)
    const r = await pedidosApi.criar(
      { cliente: '[teste-ui] máquina de estados', produto: 'Pedido de teste', quantidade: 1, valor_unitario: 10 },
      { toast: { success: 'Pedido de teste criado' } },
    )
    setOcupado(false)
    if (r.ok && r.body) {
      await queryClient.invalidateQueries({ queryKey: ['pedidos'] })
      setSelecionadoId(r.body.id)
      setTentativa(null)
      setUltimo(r)
    }
  }

  const transicionar = async (para: StatusPedido) => {
    if (!pedido || ocupado) return
    const de = pedido.status
    setOcupado(true)
    setTentativa(null)
    const r = await pedidosApi.alterarStatus(pedido.id, { status: para }, { toast: { success: `${de} → ${para}` } })
    setOcupado(false)
    setUltimo(r)
    setTentativa({ de, para, ok: r.ok, mensagem: r.ok ? undefined : (extractDetail(r.body) ?? r.error ?? undefined) })
    await queryClient.invalidateQueries({ queryKey: ['pedidos'] })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Máquina de estados"
        description="Escolha um pedido e clique num estado de destino: a UI envia o PATCH real e mostra o resultado no diagrama."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>Diagrama</CardTitle>
            <CardDescription>Setas = transições permitidas. Tracejado = disponíveis a partir do estado atual.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Label>Pedido</Label>
                <Select
                  value={selecionadoId === null ? '' : String(selecionadoId)}
                  onValueChange={(v) => {
                    setSelecionadoId(Number(v))
                    setTentativa(null)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={lista.length ? 'Selecione um pedido' : 'Nenhum pedido cadastrado'} />
                  </SelectTrigger>
                  <SelectContent>
                    {[...lista].reverse().map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        <span className="font-mono text-muted-foreground">#{p.id}</span> {p.cliente} · {p.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={criarTeste} disabled={ocupado}>
                <Plus />
                Criar pedido de teste
              </Button>
            </div>

            <div className="relative rounded-xl border bg-muted/20 p-2">
              {ocupado && <Loader2 className="absolute top-3 right-3 size-4 animate-spin text-muted-foreground" />}
              <StateMachineDiagram atual={pedido?.status ?? null} tentativa={tentativa} onSelect={pedido ? transicionar : undefined} disabled={ocupado} />
            </div>

            {tentativa && (
              <div
                className={cn(
                  'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                  tentativa.ok ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10',
                )}
              >
                {tentativa.ok ? <CheckCircle2 className="mt-0.5 size-4 text-emerald-500" /> : <XCircle className="mt-0.5 size-4 text-red-500" />}
                <div>
                  <p className="font-medium">
                    {tentativa.de} → {tentativa.para}: {ultimo?.status ?? 'rede'} {ultimo?.statusText}
                  </p>
                  {tentativa.mensagem && <p className="text-xs text-muted-foreground">{tentativa.mensagem}</p>}
                </div>
              </div>
            )}

            {!pedido && <p className="text-sm text-muted-foreground">Selecione ou crie um pedido para interagir com o diagrama.</p>}

            <Callout icon={Info}>Novos estados surgirão quando Estoque e Pagamento forem distribuídos.</Callout>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-sm">Todas as combinações</CardTitle>
              <CardDescription>Resultado esperado da API.</CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full text-xs">
                <tbody>
                  {todasTransicoes().map(({ de, para, esperado }) => (
                    <tr
                      key={`${de}-${para}`}
                      className={cn('border-b last:border-0', pedido?.status === de && 'bg-muted/60')}
                    >
                      <td className="py-1.5">
                        <PedidoStatusBadge status={de} />
                      </td>
                      <td className="text-muted-foreground">→</td>
                      <td>
                        <PedidoStatusBadge status={para} />
                      </td>
                      <td className={cn('text-right font-mono', esperado === 200 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                        {esperado}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>

      {ultimo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Última requisição</CardTitle>
          </CardHeader>
          <CardContent>
            <RequestResponsePanel result={ultimo} bodyMaxHeight="16rem" />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
