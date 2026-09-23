import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Globe, Loader2, Lock, RefreshCw, RotateCcw, ScrollText, ShieldAlert } from 'lucide-react'
import { cn } from 'cn'
import { toast } from 'sonner'
import { Callout, HealthDot, PageHeader } from '@/components/common'
import { CopyButton } from '@/components/CopyButton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { formatDuration, formatTime, formatUptime } from '@/lib/format'
import { useManualFlag, useNow } from '@/lib/hooks'
import { inspectorApi, type ContainerInfo } from '@/lib/inspector-api'
import { SAUDE_STYLE, saudeContainer, useContainers } from '@/lib/queries'

const SERVICOS = ['pedidos', 'postgres', 'inspector', 'ui'] as const

const DESCRICAO: Record<string, string> = {
  pedidos: 'API de Pedidos (FastAPI). Stateless: pode reiniciar sem perder dados.',
  postgres: 'PostgreSQL 16. Dados no volume nomeado postgres_data.',
  inspector: 'Inspetor do painel: leitura do banco e controle restrito do Docker.',
  ui: 'Este painel (nginx servindo o React + proxy /api e /inspector).',
}

function ReiniciarButton({ servico }: { servico: string }) {
  const queryClient = useQueryClient()
  const [reiniciando, setReiniciando] = useState(false)
  const reiniciar = async () => {
    setReiniciando(true)
    const r = await inspectorApi.reiniciar(servico, {
      toast: { success: `${servico} reiniciado` },
    })
    setReiniciando(false)
    if (r.ok && r.body) toast.info(`Restart levou ${formatDuration(r.body.duracao_ms)}`)
    void queryClient.invalidateQueries({ queryKey: ['containers'] })
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="xs" disabled={reiniciando}>
          {reiniciando ? <Loader2 className="animate-spin" /> : <RotateCcw />}
          {reiniciando ? 'Reiniciando…' : 'Reiniciar'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reiniciar o container {servico}?</AlertDialogTitle>
          <AlertDialogDescription>
            {servico === 'pedidos'
              ? 'A API fica indisponível por alguns segundos. Os pedidos continuam no PostgreSQL.'
              : 'O banco fica indisponível por alguns segundos e a API perde a conexão até ele voltar. Os dados continuam no volume.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={reiniciar}>Reiniciar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ServicoCard({ servico, c, agora, carregando }: { servico: string; c?: ContainerInfo; agora: number; carregando: boolean }) {
  const saude = c ? saudeContainer(c) : carregando ? 'carregando' : 'fora'
  return (
    <Card size="sm" className={cn(saude === 'degradado' && 'ring-amber-500/40', saude === 'fora' && !carregando && 'ring-red-500/40')}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Box className="size-4 text-muted-foreground" />
          <span className="font-mono">{servico}</span>
          <HealthDot saude={saude} />
        </CardTitle>
        <CardDescription className="text-xs">{DESCRICAO[servico]}</CardDescription>
        {c?.controlavel && (
          <CardAction>
            <ReiniciarButton servico={servico} />
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {carregando && !c ? (
          <Skeleton className="h-20 w-full" />
        ) : !c ? (
          <p className="text-xs text-muted-foreground">Container não encontrado no projeto.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <dt className="text-muted-foreground">Estado</dt>
              <dd className={cn('font-medium', SAUDE_STYLE[saude].text)}>{c.estado}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Health</dt>
              <dd className="font-mono">{c.health ?? 'sem healthcheck'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Uptime</dt>
              <dd className="font-mono">{c.estado === 'running' ? formatUptime(c.started_at, agora) : '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Restarts (política)</dt>
              <dd className="font-mono">{c.restart_count}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">Imagem</dt>
              <dd className="truncate font-mono" title={c.imagem}>
                {c.imagem}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">Portas publicadas no host</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {c.portas.length ? (
                  c.portas.map((p) => (
                    <Badge key={`${p.host}-${p.container}`} variant="outline" className="font-mono">
                      <Globe />
                      localhost:{p.host} → {p.container}
                    </Badge>
                  ))
                ) : (
                  <Badge
                    className={cn(
                      'font-mono',
                      servico === 'postgres' ? 'bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <Lock />
                    sem porta publicada{servico === 'postgres' && ' · só rede interna'}
                  </Badge>
                )}
              </dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  )
}

function LogsViewer() {
  const [servico, setServico] = useState('pedidos')
  const [tail, setTail] = useState(200)
  const [polling, setPolling] = useState(true)
  const [autoScroll, setAutoScroll] = useState(true)
  const manual = useManualFlag()
  const fim = useRef<HTMLDivElement>(null)

  const logs = useQuery({
    queryKey: ['logs', servico, tail],
    queryFn: () => inspectorApi.logs(servico, tail, { silent: manual.consumir() }),
    refetchInterval: polling ? 3000 : false,
  })
  const linhas = logs.data?.ok ? (logs.data.body?.linhas ?? []) : []

  useEffect(() => {
    if (autoScroll) fim.current?.scrollIntoView({ block: 'nearest' })
  }, [linhas.length, autoScroll, logs.data])

  const texto = () => linhas.map((l) => `${l.timestamp} ${l.mensagem}`).join('\n')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="size-4" />
          Logs
        </CardTitle>
        <CardDescription>Últimas linhas do container, lidas pelo inspetor via Docker.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Serviço</Label>
            <Select value={servico} onValueChange={setServico}>
              <SelectTrigger className="w-36 font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pedidos">pedidos</SelectItem>
                <SelectItem value="postgres">postgres</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Linhas</Label>
            <Select value={String(tail)} onValueChange={(v) => setTail(Number(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[100, 200, 500].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex h-8 items-center gap-2 text-xs">
            <Switch checked={polling} onCheckedChange={setPolling} />
            Atualizar a cada 3 s
          </label>
          <label className="flex h-8 items-center gap-2 text-xs">
            <Switch checked={autoScroll} onCheckedChange={setAutoScroll} />
            Rolagem automática
          </label>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                manual.marcar()
                void logs.refetch()
              }}
              disabled={logs.isFetching}
            >
              <RefreshCw className={cn(logs.isFetching && 'animate-spin')} />
              Atualizar
            </Button>
            <CopyButton variant="outline" label="Copiar" text={texto} />
          </div>
        </div>
        <div className="h-96 overflow-auto rounded-lg border bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-200">
          {!logs.data ? (
            <span className="text-zinc-500">Carregando…</span>
          ) : !logs.data.ok ? (
            <span className="text-red-400">{logs.data.error ?? `Erro ${logs.data.status}`}</span>
          ) : linhas.length === 0 ? (
            <span className="text-zinc-500">(sem linhas)</span>
          ) : (
            linhas.map((l, i) => (
              <div key={`${l.timestamp}-${i}`} className="flex gap-3 whitespace-pre-wrap break-all hover:bg-white/5">
                <span className="shrink-0 text-zinc-500 select-none">{l.timestamp ? formatTime(l.timestamp) : ''}</span>
                <span className={cn(/error|exception|fatal/i.test(l.mensagem) && 'text-red-400', /warn/i.test(l.mensagem) && 'text-amber-300')}>{l.mensagem}</span>
              </div>
            ))
          )}
          <div ref={fim} />
        </div>
      </CardContent>
    </Card>
  )
}

export function InfraestruturaPage() {
  const containers = useContainers(3000)
  const agora = useNow()
  const lista = containers.data?.ok ? (containers.data.body ?? []) : []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Infraestrutura"
        description="Containers do projeto Compose, lidos pelo inspetor. Só pedidos e postgres podem ser reiniciados; nada pode ser parado ou removido por aqui."
      />

      {containers.data && !containers.data.ok && (
        <Callout tone="warn" icon={ShieldAlert}>
          O inspetor não conseguiu falar com o Docker: {containers.data.error ?? `status ${containers.data.status}`}.
        </Callout>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {SERVICOS.map((s) => (
          <ServicoCard key={s} servico={s} c={lista.find((c) => c.servico === s)} agora={agora} carregando={!containers.data} />
        ))}
      </div>

      <LogsViewer />
    </div>
  )
}
