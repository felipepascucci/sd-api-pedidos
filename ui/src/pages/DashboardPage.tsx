import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Activity, Boxes, Database, History, Package, Server } from 'lucide-react'
import { cn } from 'cn'
import { ArchitectureDiagram } from '@/components/ArchitectureDiagram'
import { EmptyState, HealthDot, PageHeader } from '@/components/common'
import { HistoryList } from '@/components/HistoryList'
import { PedidoStatusBadge } from '@/components/PedidoStatusBadge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatBRL, formatDateTime, formatDuration } from '@/lib/format'
import { SAUDE_STYLE, saudeContainer, usePedidos, useSaude, type Saude } from '@/lib/queries'
import { STATUS, STATUS_STYLE } from '@/lib/status'
import { useHistory } from '@/stores/history'

function StatusCard({ icon: Icon, titulo, saude, children }: { icon: typeof Server; titulo: string; saude: Saude; children: ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4" />
          {titulo}
        </CardDescription>
        <CardTitle className={cn('flex items-center gap-2 text-lg', SAUDE_STYLE[saude].text)}>
          <HealthDot saude={saude} />
          {SAUDE_STYLE[saude].label}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{children}</CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { saude, api, db, lista, porServico } = useSaude()
  const pedidos = usePedidos()
  const entries = useHistory((s) => s.entries)
  const recentes = entries.slice(0, 10)

  const lista_pedidos = pedidos.data?.ok ? (pedidos.data.body ?? []) : []
  const soma = lista_pedidos.reduce((acc, p) => acc + p.valor_total, 0)
  const maisRecente = lista_pedidos.reduce<(typeof lista_pedidos)[number] | null>((m, p) => (!m || p.id > m.id ? p : m), null)
  const porStatus = STATUS.map((s) => ({ s, n: lista_pedidos.filter((p) => p.status === s).length }))
  const rodando = lista.filter((c) => c.estado === 'running').length

  const saudePostgres: Saude =
    saude.docker === 'carregando' && saude.db === 'carregando'
      ? 'carregando'
      : porServico('postgres')
        ? saudeContainer(porServico('postgres'))
        : saude.db

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Visão geral"
        description="Estado da infraestrutura em tempo real (atualiza a cada 5 s), dados agregados dos pedidos e as últimas requisições feitas pelo painel."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatusCard icon={Server} titulo="API de Pedidos" saude={saude.api}>
          {api.data?.status === 200 ? (
            <>
              <span className="font-mono">GET /health</span> respondeu em{' '}
              <span className="font-mono text-foreground">{formatDuration(api.data.durationMs)}</span>
            </>
          ) : api.data ? (
            (api.data.error ?? `GET /health → ${api.data.status}`)
          ) : (
            <Skeleton className="h-4 w-40" />
          )}
        </StatusCard>
        <StatusCard icon={Database} titulo="Banco de dados" saude={saude.db}>
          {db.data?.ok && db.data.body ? (
            <>
              PostgreSQL <span className="text-foreground">{db.data.body.versao}</span> · {db.data.body.tamanho} ·{' '}
              {db.data.body.conexoes_total} conexões
            </>
          ) : db.data ? (
            'O inspetor não conseguiu ler o banco.'
          ) : (
            <Skeleton className="h-4 w-40" />
          )}
        </StatusCard>
        <StatusCard icon={Boxes} titulo="Containers" saude={saude.docker}>
          {lista.length ? (
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <span>
                <span className="text-foreground">{rodando}</span>/{lista.length} em execução
              </span>
              {lista.map((c) => (
                <span key={c.nome} className="inline-flex items-center gap-1">
                  <HealthDot saude={saudeContainer(c)} pulse={false} />
                  {c.servico}
                </span>
              ))}
            </div>
          ) : saude.docker === 'carregando' ? (
            <Skeleton className="h-4 w-40" />
          ) : (
            'Inspetor sem acesso ao Docker.'
          )}
        </StatusCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-4" />
            Arquitetura ao vivo
          </CardTitle>
          <CardDescription>Cada componente é colorido conforme o status atual.</CardDescription>
        </CardHeader>
        <CardContent>
          <ArchitectureDiagram api={saude.api} postgres={saudePostgres} inspector={porServico('inspector') ? saudeContainer(porServico('inspector')) : 'fora'} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="size-4" />
              Pedidos
            </CardTitle>
            <CardDescription>Calculado a partir de GET /pedidos.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {pedidos.data && !pedidos.data.ok ? (
              <p className="text-sm text-muted-foreground">API indisponível no momento.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Total de pedidos</p>
                    <p className="text-2xl font-semibold tabular-nums">{pedidos.data ? lista_pedidos.length : '—'}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Soma dos valores</p>
                    <p className="truncate text-2xl font-semibold tabular-nums">{pedidos.data ? formatBRL(soma) : '—'}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {porStatus.map(({ s, n }) => (
                    <div key={s} className="flex items-center gap-3 text-xs">
                      <span className="w-24">
                        <PedidoStatusBadge status={s} />
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', STATUS_STYLE[s].dot)}
                          style={{ width: `${lista_pedidos.length ? (n / lista_pedidos.length) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="w-8 text-right font-mono tabular-nums">{n}</span>
                    </div>
                  ))}
                </div>
                {maisRecente && (
                  <div className="rounded-lg border p-3 text-xs">
                    <p className="mb-1 text-muted-foreground">Pedido mais recente</p>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-muted-foreground">#{maisRecente.id}</span>
                      <span className="truncate font-medium">{maisRecente.cliente}</span>
                      <span className="truncate text-muted-foreground">· {maisRecente.produto}</span>
                      <PedidoStatusBadge status={maisRecente.status} className="ml-auto" />
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {formatBRL(maisRecente.valor_total)} · {formatDateTime(maisRecente.data_criacao)}
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="size-4" />
              Últimas requisições
            </CardTitle>
            <CardDescription>As 10 mais recentes do histórico (polling automático não entra).</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {recentes.length ? (
              <HistoryList entries={recentes} onSelect={(e) => navigate(`/historico?id=${e.id}`)} />
            ) : (
              <div className="px-4">
                <EmptyState icon={History} title="Nenhuma requisição ainda" description="Use as páginas Pedidos, Console ou Cenários para gerar chamadas." />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
