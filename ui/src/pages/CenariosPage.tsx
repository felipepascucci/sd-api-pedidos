import { useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ChevronDown, Circle, Loader2, Play, PlayCircle, Square, XCircle } from 'lucide-react'
import { cn } from 'cn'
import { Callout, PageHeader } from '@/components/common'
import { JsonViewer } from '@/components/JsonViewer'
import { RequestResponsePanel } from '@/components/RequestResponsePanel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatDuration } from '@/lib/format'
import { CENARIOS, PREFIXO_TESTE } from '@/scenarios/definitions'
import { runScenario, type Scenario, type ScenarioResult } from '@/scenarios/runner'

type Estado = ScenarioResult | 'executando' | undefined

function IconeResultado({ estado }: { estado: Estado }) {
  if (estado === 'executando') return <Loader2 className="size-4 animate-spin text-sky-500" />
  if (!estado) return <Circle className="size-4 text-muted-foreground/40" />
  if (estado.status === 'passou') return <CheckCircle2 className="size-4 text-emerald-500" />
  if (estado.status === 'falhou') return <XCircle className="size-4 text-red-500" />
  return <AlertTriangle className="size-4 text-amber-500" />
}

function valorLegivel(v: unknown): unknown {
  return v === undefined ? '(não informado)' : v
}

function CenarioItem({ s, estado, onRun, disabled }: { s: Scenario; estado: Estado; onRun: () => void; disabled: boolean }) {
  const [aberto, setAberto] = useState(false)
  const resultado = typeof estado === 'object' ? estado : null
  const falhou = resultado && resultado.status !== 'passou'

  return (
    <li className={cn('border-b last:border-0', falhou && 'bg-red-500/[0.03]')}>
      <div className="flex items-start gap-3 px-4 py-2.5">
        <div className="mt-0.5">
          <IconeResultado estado={estado} />
        </div>
        <button type="button" className="flex min-w-0 flex-1 flex-col text-left" onClick={() => resultado && setAberto((a) => !a)} disabled={!resultado}>
          <span className="flex items-center gap-2 text-sm">
            <span className="w-9 shrink-0 font-mono text-[11px] text-muted-foreground">{s.id}</span>
            <span className="font-medium">{s.nome}</span>
            {resultado && <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform', aberto && 'rotate-180')} />}
          </span>
          <span className="pl-11 text-xs text-muted-foreground">
            {s.descricao} <span className="text-foreground/70">Esperado: {s.esperado}.</span>
          </span>
          {falhou && resultado.falha && (
            <span className="mt-1 pl-11 text-xs text-red-600 dark:text-red-400">{resultado.falha.mensagem}</span>
          )}
        </button>
        {resultado && <span className="mt-0.5 hidden font-mono text-[11px] text-muted-foreground sm:block">{formatDuration(resultado.durationMs)}</span>}
        <Button variant="ghost" size="icon-xs" onClick={onRun} disabled={disabled} title="Executar este cenário" aria-label={`Executar ${s.nome}`}>
          <Play />
        </Button>
      </div>

      {aberto && resultado && (
        <div className="flex flex-col gap-4 border-t bg-muted/20 px-4 py-4 sm:pl-16">
          {falhou && resultado.falha && (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">Esperado</p>
                <JsonViewer value={valorLegivel(resultado.falha.esperado)} maxHeight="10rem" />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-red-600 dark:text-red-400">Obtido</p>
                <JsonViewer value={valorLegivel(resultado.falha.obtido)} maxHeight="10rem" />
              </div>
            </div>
          )}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium text-muted-foreground">Passos ({resultado.passos.length} requisição(ões))</p>
            {resultado.passos.map((p, i) => (
              <div key={p.id} className="rounded-lg border bg-card p-3">
                <p className="mb-2 text-[11px] text-muted-foreground">Passo {i + 1}</p>
                <RequestResponsePanel result={p} bodyMaxHeight="14rem" />
              </div>
            ))}
          </div>
        </div>
      )}
    </li>
  )
}

export function CenariosPage() {
  const queryClient = useQueryClient()
  const [resultados, setResultados] = useState<Record<string, Estado>>({})
  const [executando, setExecutando] = useState(false)
  const parar = useRef(false)

  const grupos = useMemo(() => {
    const mapa = new Map<string, Scenario[]>()
    for (const s of CENARIOS) mapa.set(s.grupo, [...(mapa.get(s.grupo) ?? []), s])
    return [...mapa.entries()]
  }, [])

  const valores = Object.values(resultados).filter((r): r is ScenarioResult => typeof r === 'object')
  const passou = valores.filter((r) => r.status === 'passou').length
  const falhou = valores.length - passou
  const progresso = (valores.length / CENARIOS.length) * 100

  const executar = async (lista: Scenario[]) => {
    setExecutando(true)
    parar.current = false
    if (lista.length > 1) setResultados({})
    for (const s of lista) {
      if (parar.current) break
      setResultados((r) => ({ ...r, [s.id]: 'executando' }))
      const res = await runScenario(s)
      setResultados((r) => ({ ...r, [s.id]: res }))
    }
    setExecutando(false)
    void queryClient.invalidateQueries({ queryKey: ['pedidos'] })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cenários de validação"
        description={`${CENARIOS.length} cenários automatizados cobrindo criação, validações, consulta, máquina de estados e consistência com o banco.`}
        actions={
          executando ? (
            <Button variant="outline" onClick={() => (parar.current = true)}>
              <Square />
              Parar
            </Button>
          ) : (
            <Button onClick={() => executar(CENARIOS)}>
              <PlayCircle />
              Executar todos
            </Button>
          )
        }
      />

      <Callout tone="warn" icon={AlertTriangle}>
        Os pedidos criados pelos cenários usam o cliente com prefixo <code>{PREFIXO_TESTE}</code> e <strong>permanecem no banco</strong>: a API não tem DELETE e o
        inspetor é somente leitura.
      </Callout>

      <Card size="sm">
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span>
              <span className="font-semibold tabular-nums">{valores.length}</span>
              <span className="text-muted-foreground">/{CENARIOS.length} executados</span>
            </span>
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
              <span className="font-semibold tabular-nums">{passou}</span> passaram
            </span>
            <span className={cn('flex items-center gap-1.5', falhou ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
              <XCircle className="size-4" />
              <span className="font-semibold tabular-nums">{falhou}</span> falharam
            </span>
            {valores.length === CENARIOS.length && !executando && (
              <span className={cn('ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium', falhou ? 'bg-red-500/15 text-red-600 dark:text-red-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400')}>
                {falhou ? 'Há falhas: clique no cenário para ver esperado x obtido' : 'Todos os cenários passaram'}
              </span>
            )}
          </div>
          <Progress value={progresso} />
        </CardContent>
      </Card>

      {grupos.map(([grupo, cenarios]) => (
        <Card key={grupo} className="gap-0 py-0">
          <CardHeader className="border-b py-3">
            <CardTitle className="text-sm">{grupo}</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <ul>
              {cenarios.map((s) => (
                <CenarioItem key={s.id} s={s} estado={resultados[s.id]} onRun={() => executar([s])} disabled={executando} />
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
