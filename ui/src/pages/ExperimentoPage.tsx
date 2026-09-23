import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Circle, Database, FlaskConical, Loader2, Play, RotateCcw, XCircle } from 'lucide-react'
import { cn } from 'cn'
import { Callout, PageHeader } from '@/components/common'
import { JsonViewer } from '@/components/JsonViewer'
import { RequestResponsePanel } from '@/components/RequestResponsePanel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDuration, formatTime } from '@/lib/format'
import type { HttpResult } from '@/lib/http'
import { inspectorApi, type RestartResult } from '@/lib/inspector-api'
import { pedidosApi, type Pedido } from '@/lib/pedidos-api'

const ETAPAS = [
  { id: 'criar', titulo: 'Criar pedido pela API' },
  { id: 'consultar', titulo: 'Consultar o pedido' },
  { id: 'reiniciar', titulo: 'Reiniciar o container' },
  { id: 'acompanhar', titulo: 'Acompanhar a indisponibilidade' },
  { id: 'reconsultar', titulo: 'Consultar novamente e comparar' },
  { id: 'conclusao', titulo: 'Conclusão' },
] as const

type EtapaId = (typeof ETAPAS)[number]['id']
type EtapaStatus = 'pendente' | 'executando' | 'ok' | 'falhou'
type Servico = 'pedidos' | 'postgres'

interface Batida {
  t: number
  ok: boolean
  status: number | null
  /** Tempo de resposta: durante um restart, a requisição pode ficar esperando em vez de falhar. */
  ms: number
}

/** Acima disso a batida é considerada "lenta" (esperou o serviço voltar). */
const LENTA_MS = 1000

interface Estado {
  servico: Servico
  etapas: Record<EtapaId, EtapaStatus>
  criado?: HttpResult<Pedido>
  consulta1?: HttpResult<Pedido>
  restart?: HttpResult<RestartResult>
  batidas: Batida[]
  leiturasBanco: (Batida & { encontrado: boolean })[]
  queda?: number
  volta?: number
  consulta2?: HttpResult<Pedido>
  erro?: string
}

const CAMPOS: (keyof Pedido)[] = ['id', 'cliente', 'produto', 'quantidade', 'valor_unitario', 'valor_total', 'status', 'data_criacao']
const POLL_MS = 500
const TIMEOUT_MS = 90_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function estadoInicial(servico: Servico): Estado {
  return {
    servico,
    etapas: Object.fromEntries(ETAPAS.map((e) => [e.id, 'pendente'])) as Record<EtapaId, EtapaStatus>,
    batidas: [],
    leiturasBanco: [],
  }
}

function IconeEtapa({ status }: { status: EtapaStatus }) {
  if (status === 'executando') return <Loader2 className="size-5 animate-spin text-sky-500" />
  if (status === 'ok') return <CheckCircle2 className="size-5 text-emerald-500" />
  if (status === 'falhou') return <XCircle className="size-5 text-red-500" />
  return <Circle className="size-5 text-muted-foreground/40" />
}

function Batidas({ batidas, queda, volta }: { batidas: Batida[]; queda?: number; volta?: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-0.5">
        {batidas.map((b) => (
          <span
            key={b.t}
            title={`${formatTime(b.t)} → ${b.status ?? 'rede'} em ${formatDuration(b.ms)}`}
            className={cn(
              'h-5 w-1.5 rounded-sm',
              !b.ok ? 'bg-red-500' : b.ms > LENTA_MS ? 'bg-amber-500' : 'bg-emerald-500',
              queda && volta && b.t >= queda && b.t < volta && 'animate-pulse',
            )}
          />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Cada barra é uma requisição (a cada {POLL_MS} ms): verde respondeu 200, âmbar respondeu 200 mas demorou mais de {formatDuration(LENTA_MS)}, vermelho
        não respondeu 200.
      </p>
    </div>
  )
}

export function ExperimentoPage() {
  const queryClient = useQueryClient()
  const [estado, setEstado] = useState<Estado>(() => estadoInicial('pedidos'))
  const [rodando, setRodando] = useState(false)
  const cancelado = useRef(false)

  useEffect(() => {
    cancelado.current = false
    return () => {
      cancelado.current = true
    }
  }, [])

  const patch = (p: Partial<Estado> | ((e: Estado) => Partial<Estado>)) =>
    setEstado((e) => ({ ...e, ...(typeof p === 'function' ? p(e) : p) }))
  const etapa = (id: EtapaId, status: EtapaStatus) => setEstado((e) => ({ ...e, etapas: { ...e.etapas, [id]: status } }))

  const executar = async (servico: Servico) => {
    setRodando(true)
    setEstado(estadoInicial(servico))
    try {
      // 1. Criar
      etapa('criar', 'executando')
      const criado = await pedidosApi.criar(
        { cliente: `[teste-ui] experimento${servico === 'postgres' ? ' (postgres)' : ''}`, produto: 'Teclado', quantidade: 2, valor_unitario: 149.9 },
        { toast: { success: 'Pedido do experimento criado' } },
      )
      patch({ criado })
      if (criado.status !== 201 || !criado.body) throw new Error('Não foi possível criar o pedido. A API está no ar?')
      etapa('criar', 'ok')
      const id = criado.body.id

      // 2. Consultar
      etapa('consultar', 'executando')
      const consulta1 = await pedidosApi.consultar(id)
      patch({ consulta1 })
      if (consulta1.status !== 200) throw new Error('A consulta inicial falhou.')
      etapa('consultar', 'ok')

      // 3 + 4. Reiniciar e, em paralelo, acompanhar a API e o banco.
      etapa('reiniciar', 'executando')
      etapa('acompanhar', 'executando')
      let queda: number | undefined
      let volta: number | undefined
      let restartTerminou: number | undefined
      const inicio = Date.now()

      const alvo = () => (servico === 'pedidos' ? pedidosApi.health({ silent: true }) : pedidosApi.consultar(id, { silent: true }))
      const acabou = () =>
        cancelado.current ||
        Date.now() - inicio > TIMEOUT_MS ||
        (restartTerminou !== undefined && (volta !== undefined || (queda === undefined && Date.now() - restartTerminou > 3000)))

      const pollApi = async () => {
        while (!acabou()) {
          const t = Date.now()
          const r = await alvo()
          const ok = r.status === 200
          if (!ok && queda === undefined) queda = t
          if (ok && queda !== undefined && volta === undefined) volta = t
          patch((e) => ({ batidas: [...e.batidas, { t, ok, status: r.status, ms: r.durationMs }], queda, volta }))
          await sleep(Math.max(0, POLL_MS - (Date.now() - t)))
        }
      }
      const pollBanco = async () => {
        while (!acabou()) {
          const t = Date.now()
          const r = await inspectorApi.linhas('pedidos', { order_by: 'id', direction: 'desc', limit: 50 }, { silent: true })
          const encontrado = !!r.body?.rows?.some((row) => row.id === id)
          patch((e) => ({ leiturasBanco: [...e.leiturasBanco, { t, ok: r.status === 200, status: r.status, ms: r.durationMs, encontrado }] }))
          await sleep(Math.max(0, POLL_MS - (Date.now() - t)))
        }
      }

      const monitores = Promise.all([pollApi(), pollBanco()])
      await sleep(POLL_MS) // uma batida "antes" do restart, para referência
      const restart = await inspectorApi.reiniciar(servico)
      restartTerminou = Date.now()
      patch({ restart })
      etapa('reiniciar', restart.ok ? 'ok' : 'falhou')
      await monitores
      if (!restart.ok) throw new Error('O inspetor não conseguiu reiniciar o container.')
      if (queda !== undefined && volta === undefined) {
        etapa('acompanhar', 'falhou')
        throw new Error('A API não voltou dentro do tempo limite.')
      }
      etapa('acompanhar', 'ok')

      // 5. Reconsultar e comparar
      etapa('reconsultar', 'executando')
      const consulta2 = await pedidosApi.consultar(id)
      patch({ consulta2 })
      const iguais = consulta2.status === 200 && CAMPOS.every((c) => consulta1.body?.[c] === consulta2.body?.[c])
      etapa('reconsultar', iguais ? 'ok' : 'falhou')
      etapa('conclusao', iguais ? 'ok' : 'falhou')
      void queryClient.invalidateQueries({ queryKey: ['pedidos'] })
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e)
      setEstado((s) => ({
        ...s,
        erro: mensagem,
        etapas: Object.fromEntries(Object.entries(s.etapas).map(([k, v]) => [k, v === 'executando' ? 'falhou' : v])) as Record<EtapaId, EtapaStatus>,
      }))
    } finally {
      setRodando(false)
    }
  }

  const { servico, criado, consulta1, restart, batidas, leiturasBanco, queda, volta, consulta2, erro } = estado
  const leiturasNaQueda = queda && volta ? leiturasBanco.filter((l) => l.t >= queda && l.t <= volta) : []
  const maiorLatencia = batidas.reduce((m, b) => Math.max(m, b.ms), 0)
  const iniciou = estado.etapas.criar !== 'pendente'
  const sucesso = estado.etapas.conclusao === 'ok'

  const conteudo: Record<EtapaId, ReactNode> = {
    criar: criado && <RequestResponsePanel result={criado} bodyMaxHeight="12rem" />,
    consultar: consulta1?.body && <JsonViewer value={consulta1.body} maxHeight="12rem" />,
    reiniciar: restart && (
      <p className="text-sm">
        {restart.ok && restart.body ? (
          <>
            <code>docker restart</code> do serviço <strong className="font-mono">{servico}</strong> concluído em{' '}
            <span className="font-mono">{formatDuration(restart.body.duracao_ms)}</span>. Novo início: <span className="font-mono">{formatTime(restart.body.started_at)}</span>.
          </>
        ) : (
          <span className="text-red-500">Falhou: {restart.error ?? restart.status}</span>
        )}
      </p>
    ),
    acompanhar: batidas.length > 0 && (
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          Polling de <code>{servico === 'pedidos' ? 'GET /api/health' : `GET /api/pedidos/${criado?.body?.id}`}</code>
          {servico === 'postgres' && ' (o /health não depende do banco, então aqui acompanhamos uma consulta real)'}.
        </p>
        <Batidas batidas={batidas} queda={queda} volta={volta} />
        <div className="grid gap-2 text-xs sm:grid-cols-3">
          <div className="rounded-lg border px-3 py-2">
            <p className="text-muted-foreground">Caiu às</p>
            <p className="font-mono">{queda ? formatTime(queda) : estado.etapas.acompanhar === 'ok' ? 'queda não observada' : '…'}</p>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <p className="text-muted-foreground">Voltou às</p>
            <p className="font-mono">{volta ? formatTime(volta) : '…'}</p>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <p className="text-muted-foreground">Indisponível por</p>
            <p className="font-mono font-semibold">{queda && volta ? formatDuration(volta - queda) : '…'}</p>
          </div>
        </div>
        {queda !== undefined && volta !== undefined && (
          <div className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs">
            <Database className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            {servico === 'pedidos' ? (
              <span>
                Durante a indisponibilidade, o inspetor leu o banco <strong>{leiturasNaQueda.filter((l) => l.ok).length}</strong> vez(es) e encontrou o pedido em{' '}
                <strong>{leiturasNaQueda.filter((l) => l.encontrado).length}</strong>: o dado continuou no PostgreSQL enquanto a API estava fora.
              </span>
            ) : (
              <span>
                Com o próprio PostgreSQL reiniciando, o inspetor também não consegue ler ({leiturasNaQueda.filter((l) => !l.ok).length} leitura(s) falharam). Os dados estão nos
                arquivos do volume, não na memória do processo.
              </span>
            )}
          </div>
        )}
        {queda === undefined && estado.etapas.acompanhar === 'ok' && (
          <p className="text-xs text-muted-foreground">
            Nenhuma requisição falhou.{' '}
            {maiorLatencia > LENTA_MS
              ? `Durante o restart, as requisições ficaram esperando o ${servico} voltar em vez de falhar (maior tempo de resposta: ${formatDuration(maiorLatencia)}).`
              : 'O restart foi mais rápido que o intervalo de polling.'}
          </p>
        )}
      </div>
    ),
    reconsultar: consulta2 && consulta1?.body && (
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium">Campo</th>
              <th className="px-3 py-1.5 text-left font-medium">Antes do restart</th>
              <th className="px-3 py-1.5 text-left font-medium">Depois do restart</th>
              <th className="px-3 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {CAMPOS.map((c) => {
              const antes = consulta1.body?.[c]
              const depois = consulta2.body?.[c]
              return (
                <tr key={c} className="border-t">
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">{c}</td>
                  <td className="px-3 py-1.5 font-mono break-all">{String(antes)}</td>
                  <td className="px-3 py-1.5 font-mono break-all">{consulta2.ok ? String(depois) : '—'}</td>
                  <td className="px-3 py-1.5 text-center">{antes === depois ? <CheckCircle2 className="inline size-4 text-emerald-500" /> : <XCircle className="inline size-4 text-red-500" />}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    ),
    conclusao: sucesso && (
      <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm leading-relaxed">
        <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400">✅ Dado preservado</p>
        <p>
          O pedido <strong>não fica na memória da aplicação</strong>, e sim no <strong>PostgreSQL</strong>, que é outro processo, em outro container.
        </p>
        <p>
          Os arquivos do banco ficam no <strong>volume Docker nomeado</strong> <code>postgres_data</code>, que existe independentemente do ciclo de vida dos containers.
        </p>
        <p>
          {servico === 'pedidos'
            ? 'Reiniciar o container pedidos não afeta nem o postgres nem o volume. Como a API é stateless, ao voltar ela apenas reconecta ao banco e lê os dados.'
            : 'Mesmo reiniciando o próprio PostgreSQL, os dados sobrevivem: ao voltar, o banco lê os arquivos do volume. A API reconecta sozinha (pool_pre_ping).'}
        </p>
        <p className="text-xs text-muted-foreground">
          Já <code>docker compose down -v</code> removeria o volume e, aí sim, apagaria os dados.
        </p>
      </div>
    ),
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Experimento: o dado está onde?"
        description="Reproduz o experimento da disciplina: cria um pedido, reinicia só o container da aplicação e confirma que o pedido continua lá."
        actions={
          <>
            <Button onClick={() => executar('pedidos')} disabled={rodando}>
              {rodando && servico === 'pedidos' ? <Loader2 className="animate-spin" /> : iniciou ? <RotateCcw /> : <Play />}
              {iniciou && servico === 'pedidos' ? 'Executar de novo' : 'Iniciar experimento'}
            </Button>
            <Button variant="outline" onClick={() => executar('postgres')} disabled={rodando}>
              {rodando && servico === 'postgres' ? <Loader2 className="animate-spin" /> : <Database />}
              Repetir reiniciando o postgres
            </Button>
          </>
        }
      />

      <Callout icon={FlaskConical}>
        O pedido criado usa o cliente <code>[teste-ui] experimento</code> e permanece no banco (a API não tem DELETE). Durante o restart, a API e as telas que dependem
        dela ficam indisponíveis por alguns segundos: isso é esperado.
      </Callout>

      {erro && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{erro}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Etapas {iniciou && <span className="font-normal text-muted-foreground">· reiniciando <code>{servico}</code></span>}
          </CardTitle>
          <CardDescription>{iniciou ? 'Acompanhe cada etapa abaixo.' : 'Clique em "Iniciar experimento" para começar.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="relative flex flex-col">
            {ETAPAS.map((e, i) => {
              const status = estado.etapas[e.id]
              const titulo = e.id === 'reiniciar' ? `Reiniciar somente o container ${servico}` : e.titulo
              return (
                <li key={e.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < ETAPAS.length - 1 && (
                    <span className={cn('absolute top-6 left-2.5 h-[calc(100%-1.5rem)] w-px', status === 'ok' ? 'bg-emerald-500/50' : 'bg-border')} />
                  )}
                  <div className="relative z-10 bg-card">
                    <IconeEtapa status={status} />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <p className={cn('text-sm font-medium', status === 'pendente' && 'text-muted-foreground')}>
                      {i + 1}. {titulo}
                    </p>
                    {status !== 'pendente' && conteudo[e.id]}
                  </div>
                </li>
              )
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
