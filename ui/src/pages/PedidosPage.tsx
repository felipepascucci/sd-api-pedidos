import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, PackageOpen, RefreshCw, Search, ServerCrash } from 'lucide-react'
import { cn } from 'cn'
import { EmptyState, PageHeader } from '@/components/common'
import { NovoPedidoDialog } from '@/components/NovoPedidoDialog'
import { PedidoDetalheSheet } from '@/components/PedidoDetalheSheet'
import { PedidoStatusBadge } from '@/components/PedidoStatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatBRL, formatDateTime } from '@/lib/format'
import type { Pedido } from '@/lib/pedidos-api'
import { usePedidos } from '@/lib/queries'
import { STATUS } from '@/lib/status'

type Coluna = keyof Pedido

const COLUNAS: { key: Coluna; label: string; className?: string }[] = [
  { key: 'id', label: 'ID', className: 'w-16' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'produto', label: 'Produto' },
  { key: 'quantidade', label: 'Qtd.', className: 'text-right' },
  { key: 'valor_unitario', label: 'Valor unit.', className: 'text-right' },
  { key: 'valor_total', label: 'Valor total', className: 'text-right' },
  { key: 'status', label: 'Status' },
  { key: 'data_criacao', label: 'Criado em' },
]

export function PedidosPage() {
  const pedidos = usePedidos()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('TODOS')
  const [ordem, setOrdem] = useState<{ col: Coluna; dir: 'asc' | 'desc' }>({ col: 'id', dir: 'desc' })
  const [selecionado, setSelecionado] = useState<number | null>(null)

  const lista = useMemo(() => {
    const todos = pedidos.data?.ok ? (pedidos.data.body ?? []) : []
    const termo = busca.trim().toLowerCase()
    return todos
      .filter((p) => filtro === 'TODOS' || p.status === filtro)
      .filter((p) => !termo || p.cliente.toLowerCase().includes(termo) || p.produto.toLowerCase().includes(termo))
      .sort((a, b) => {
        const va = a[ordem.col]
        const vb = b[ordem.col]
        const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR')
        return ordem.dir === 'asc' ? cmp : -cmp
      })
  }, [pedidos.data, busca, filtro, ordem])

  const total = pedidos.data?.ok ? (pedidos.data.body?.length ?? 0) : 0

  const ordenar = (col: Coluna) =>
    setOrdem((o) => (o.col === col ? { col, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pedidos"
        description="Pedidos retornados por GET /pedidos. Clique numa linha para ver os detalhes e testar as mudanças de status."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => pedidos.refetch()} disabled={pedidos.isFetching}>
              <RefreshCw className={cn(pedidos.isFetching && 'animate-spin')} />
              Atualizar
            </Button>
            <NovoPedidoDialog onCreated={(p) => setSelecionado(p.id)} />
          </>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por cliente ou produto" className="pl-8" />
        </div>
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os status</SelectItem>
            {STATUS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="py-0">
        <CardContent className="px-0">
          {!pedidos.data ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : !pedidos.data.ok ? (
            <div className="p-4">
              <EmptyState
                icon={ServerCrash}
                title="API indisponível"
                description={pedidos.data.error ?? `GET /pedidos respondeu ${pedidos.data.status}. A tabela volta sozinha quando a API responder.`}
              />
            </div>
          ) : lista.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={PackageOpen}
                title={total ? 'Nenhum pedido corresponde ao filtro' : 'Nenhum pedido cadastrado'}
                description={total ? 'Ajuste a busca ou o filtro de status.' : 'Crie o primeiro pedido pelo botão "Novo pedido".'}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {COLUNAS.map((c) => (
                    <TableHead key={c.key} className={c.className}>
                      <button
                        type="button"
                        onClick={() => ordenar(c.key)}
                        className={cn('inline-flex items-center gap-1 hover:text-foreground', c.className?.includes('text-right') && 'flex-row-reverse')}
                      >
                        {c.label}
                        {ordem.col === c.key ? (
                          ordem.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                        ) : (
                          <ArrowUpDown className="size-3 opacity-40" />
                        )}
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((p) => (
                  <TableRow key={p.id} onClick={() => setSelecionado(p.id)} className="cursor-pointer">
                    <TableCell className="font-mono text-muted-foreground">{p.id}</TableCell>
                    <TableCell className="max-w-48 truncate font-medium">{p.cliente}</TableCell>
                    <TableCell className="max-w-48 truncate">{p.produto}</TableCell>
                    <TableCell className="text-right font-mono">{p.quantidade}</TableCell>
                    <TableCell className="text-right font-mono">{formatBRL(p.valor_unitario)}</TableCell>
                    <TableCell className="text-right font-mono font-medium">{formatBRL(p.valor_total)}</TableCell>
                    <TableCell>
                      <PedidoStatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(p.data_criacao)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {pedidos.data?.ok && (
        <p className="-mt-3 text-xs text-muted-foreground">
          Exibindo {lista.length} de {total} pedido(s). Atualiza automaticamente a cada 5 s.
        </p>
      )}

      <PedidoDetalheSheet pedidoId={selecionado} onClose={() => setSelecionado(null)} />
    </div>
  )
}
