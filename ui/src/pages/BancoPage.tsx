import { useEffect, useMemo, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Database, DatabaseZap, Info, Lock, RefreshCw, Table2 } from 'lucide-react'
import { cn } from 'cn'
import { Callout, EmptyState, PageHeader } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDateTime } from '@/lib/format'
import { useManualFlag } from '@/lib/hooks'
import { inspectorApi, type Linha } from '@/lib/inspector-api'
import { POLL_MS, useDbInfo } from '@/lib/queries'

const PAGE_SIZE = 25

function celula(valor: Linha[string], coluna: string): string {
  if (valor === null) return 'NULL'
  if (coluna.startsWith('data') && typeof valor === 'string') return formatDateTime(valor)
  return String(valor)
}

function InfoCard() {
  const info = useDbInfo()
  const d = info.data?.ok ? info.data.body : null
  const somenteLeitura = d?.default_transaction_read_only === 'on'
  const itens: [string, string | number | undefined][] = [
    ['Versão', d?.versao],
    ['Banco', d?.banco],
    ['Tamanho', d?.tamanho],
    ['Conexões ativas', d ? `${d.conexoes_ativas} (de ${d.conexoes_total})` : undefined],
    ['Horário do servidor', d ? formatDateTime(d.horario_servidor) : undefined],
    ['default_transaction_read_only', d?.default_transaction_read_only],
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="size-4" />
          PostgreSQL
          {somenteLeitura && (
            <Badge className="bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30 dark:text-emerald-400">
              <Lock />
              Somente leitura
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="truncate">{d?.versao_completa ?? (info.data ? 'Banco indisponível para o inspetor' : 'Carregando…')}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3 xl:grid-cols-6">
          {itens.map(([k, v]) => (
            <div key={k} className="min-w-0 rounded-lg border px-3 py-2">
              <dt className="truncate text-[11px] text-muted-foreground" title={k}>
                {k}
              </dt>
              <dd className={cn('truncate font-mono text-sm', k === 'default_transaction_read_only' && v === 'on' && 'text-emerald-600 dark:text-emerald-400')}>
                {info.data ? (v ?? '—') : <Skeleton className="mt-1 h-4 w-16" />}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

function SchemaTab({ tabela }: { tabela: string }) {
  const schema = useQuery({ queryKey: ['schema', tabela], queryFn: () => inspectorApi.schema(tabela, { silent: true }) })
  const s = schema.data?.ok ? schema.data.body : null
  if (!schema.data) return <Skeleton className="h-40 w-full" />
  if (!s) return <EmptyState icon={DatabaseZap} title="Não foi possível ler o schema" description={schema.data.error ?? `Status ${schema.data.status}`} />

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Colunas</h3>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Nullable</TableHead>
                <TableHead>Default</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.colunas.map((c) => (
                <TableRow key={c.nome}>
                  <TableCell className="font-mono text-muted-foreground">{c.posicao}</TableCell>
                  <TableCell className="font-mono font-medium">{c.nome}</TableCell>
                  <TableCell className="font-mono text-sky-600 dark:text-sky-300">{c.tipo}</TableCell>
                  <TableCell>{c.nullable ? 'sim' : <span className="text-muted-foreground">NOT NULL</span>}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.default ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Constraints</h3>
        <div className="flex flex-col gap-2">
          {s.constraints.map((c) => (
            <div key={c.nome} className="flex flex-col gap-1 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
              <Badge variant={c.tipo === 'CHECK' ? 'secondary' : 'outline'} className="w-fit font-mono">
                {c.tipo}
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">{c.nome}</span>
              <code className="text-xs text-amber-700 sm:ml-auto dark:text-amber-300">{c.definicao}</code>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Índices</h3>
        {s.indices.map((i) => (
          <div key={i.nome} className="rounded-lg border px-3 py-2">
            <p className="font-mono text-xs text-muted-foreground">{i.nome}</p>
            <code className="text-xs break-all">{i.definicao}</code>
          </div>
        ))}
      </section>
    </div>
  )
}

function DadosTab({ tabela }: { tabela: string }) {
  const [offset, setOffset] = useState(0)
  const [ordem, setOrdem] = useState<{ col: string | undefined; dir: 'asc' | 'desc' }>({ col: undefined, dir: 'desc' })
  const [auto, setAuto] = useState(false)
  const manual = useManualFlag()

  const rows = useQuery({
    queryKey: ['rows', tabela, offset, ordem.col, ordem.dir],
    queryFn: () =>
      inspectorApi.linhas(tabela, { limit: PAGE_SIZE, offset, order_by: ordem.col, direction: ordem.dir }, { silent: manual.consumir() }),
    refetchInterval: auto ? 2000 : POLL_MS,
    placeholderData: keepPreviousData,
  })

  // Destaque de linhas novas/alteradas desde a última leitura (por id + conteúdo).
  const anteriores = useRef<Map<string, string> | null>(null)
  const [destacadas, setDestacadas] = useState<Set<string>>(new Set())
  const dados = rows.data?.ok ? rows.data.body : null

  useEffect(() => {
    if (!dados) return
    const atual = new Map(dados.rows.map((r) => [String(r.id ?? JSON.stringify(r)), JSON.stringify(r)]))
    const prev = anteriores.current
    if (prev) {
      setDestacadas(new Set([...atual].filter(([id, conteudo]) => prev.has(id) ? prev.get(id) !== conteudo : true).map(([id]) => id)))
    }
    anteriores.current = atual
  }, [dados])

  // Ao trocar de página/ordem, não destacar tudo como "novo".
  useEffect(() => {
    anteriores.current = null
    setDestacadas(new Set())
  }, [tabela, offset, ordem.col, ordem.dir])

  const ordenar = (col: string) => {
    setOffset(0)
    setOrdem((o) => (o.col === col ? { col, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }))
  }

  if (!rows.data) return <Skeleton className="h-40 w-full" />
  if (!dados) return <EmptyState icon={DatabaseZap} title="Não foi possível ler os dados" description={rows.data.error ?? `Status ${rows.data.status}`} />

  const colOrdem = ordem.col ?? (dados.columns.includes('id') ? 'id' : dados.columns[0])
  const pagina = Math.floor(offset / PAGE_SIZE) + 1
  const paginas = Math.max(1, Math.ceil(dados.total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs">
          <Switch checked={auto} onCheckedChange={setAuto} />
          Auto-refresh (2 s)
        </label>
        <Button
          variant="outline"
          size="xs"
          onClick={() => {
            manual.marcar()
            void rows.refetch()
          }}
          disabled={rows.isFetching}
        >
          <RefreshCw className={cn(rows.isFetching && 'animate-spin')} />
          Atualizar
        </Button>
        <span className="text-xs text-muted-foreground">
          {dados.total} linha(s) · linhas novas ou alteradas piscam em verde
        </span>
      </div>

      {dados.rows.length === 0 ? (
        <EmptyState icon={Table2} title="Tabela vazia" description="Crie um pedido pela página Pedidos e ele aparece aqui." />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {dados.columns.map((c) => (
                  <TableHead key={c}>
                    <button type="button" onClick={() => ordenar(c)} className="inline-flex items-center gap-1 font-mono text-xs hover:text-foreground">
                      {c}
                      {colOrdem === c && (ordem.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dados.rows.map((r) => {
                const id = String(r.id ?? JSON.stringify(r))
                const conteudo = JSON.stringify(r)
                return (
                  <TableRow key={`${id}:${conteudo}`} className={cn(destacadas.has(id) && 'animate-flash-row')}>
                    {dados.columns.map((c) => (
                      <TableCell key={c} className={cn('font-mono text-xs whitespace-nowrap', r[c] === null && 'text-muted-foreground italic')}>
                        {celula(r[c], c)}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        Página {pagina} de {paginas}
        <Button variant="outline" size="icon-xs" onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0} aria-label="Página anterior">
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => setOffset(offset + PAGE_SIZE)}
          disabled={offset + PAGE_SIZE >= dados.total}
          aria-label="Próxima página"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}

export function BancoPage() {
  const tabelas = useQuery({ queryKey: ['tabelas'], queryFn: () => inspectorApi.tabelas({ silent: true }), refetchInterval: POLL_MS })
  const lista = useMemo(() => (tabelas.data?.ok ? (tabelas.data.body ?? []) : []), [tabelas.data])
  const [tabela, setTabela] = useState<string | null>(null)
  const atual = tabela ?? (lista.find((t) => t.nome === 'pedidos') ?? lista[0])?.nome ?? null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Banco de dados" description="O conteúdo real do PostgreSQL: tabelas, schema e linhas, lidos pelo inspetor." />

      <Callout icon={Info}>
        Estes dados vêm <strong>direto do PostgreSQL pelo inspetor</strong>, não pela API de Pedidos. A conexão do inspetor é aberta com{' '}
        <code>default_transaction_read_only=on</code>: ele não consegue escrever no banco.
      </Callout>

      <InfoCard />

      <div className="grid gap-4 lg:grid-cols-[14rem_1fr]">
        <Card size="sm" className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm">Tabelas (schema public)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 px-2">
            {!tabelas.data && <Skeleton className="h-8 w-full" />}
            {tabelas.data && !tabelas.data.ok && <p className="px-2 text-xs text-muted-foreground">Inspetor indisponível.</p>}
            {tabelas.data?.ok && lista.length === 0 && <p className="px-2 text-xs text-muted-foreground">Nenhuma tabela.</p>}
            {lista.map((t) => (
              <button
                key={t.nome}
                type="button"
                onClick={() => setTabela(t.nome)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted',
                  atual === t.nome && 'bg-muted font-medium',
                )}
              >
                <Table2 className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate font-mono">{t.nome}</span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">{t.linhas}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardContent>
            {atual ? (
              <Tabs defaultValue="dados">
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="font-mono text-sm font-semibold">public.{atual}</h2>
                  <TabsList className="ml-auto">
                    <TabsTrigger value="dados">Dados</TabsTrigger>
                    <TabsTrigger value="schema">Schema</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="dados">
                  <DadosTab key={atual} tabela={atual} />
                </TabsContent>
                <TabsContent value="schema">
                  <SchemaTab tabela={atual} />
                </TabsContent>
              </Tabs>
            ) : (
              <EmptyState icon={Database} title="Nenhuma tabela selecionada" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
