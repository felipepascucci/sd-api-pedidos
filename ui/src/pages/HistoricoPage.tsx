import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { History, Loader2, RotateCw, Search, Trash2 } from 'lucide-react'
import { CopyButton } from '@/components/CopyButton'
import { EmptyState, PageHeader } from '@/components/common'
import { HistoryList } from '@/components/HistoryList'
import { RequestResponsePanel } from '@/components/RequestResponsePanel'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toCurl } from '@/lib/curl'
import { request, type HttpResult } from '@/lib/http'
import { HISTORY_LIMIT, useHistory } from '@/stores/history'

type Faixa = 'todas' | '2xx' | '4xx' | '5xx' | 'rede'

export function faixaDe(e: Pick<HttpResult, 'status' | 'unavailable'>): Exclude<Faixa, 'todas'> | 'outro' {
  if (e.status === null || e.unavailable) return 'rede'
  if (e.status >= 500) return '5xx'
  if (e.status >= 400) return '4xx'
  if (e.status >= 200 && e.status < 300) return '2xx'
  return 'outro'
}

export function HistoricoPage() {
  const entries = useHistory((s) => s.entries)
  const clear = useHistory((s) => s.clear)
  const [params, setParams] = useSearchParams()
  const [origem, setOrigem] = useState('todas')
  const [metodo, setMetodo] = useState('todos')
  const [faixa, setFaixa] = useState<Faixa>('todas')
  const [busca, setBusca] = useState('')
  const [reenviando, setReenviando] = useState(false)

  const selecionadoId = params.get('id')
  const selecionado = entries.find((e) => e.id === selecionadoId) ?? null

  const filtrados = useMemo(
    () =>
      entries.filter(
        (e) =>
          (origem === 'todas' || e.origem === origem) &&
          (metodo === 'todos' || e.method === metodo) &&
          (faixa === 'todas' || faixaDe(e) === faixa) &&
          (!busca.trim() || e.path.toLowerCase().includes(busca.trim().toLowerCase())),
      ),
    [entries, origem, metodo, faixa, busca],
  )

  const selecionar = (e: HttpResult) => setParams({ id: e.id }, { replace: true })

  const reenviar = async (e: HttpResult) => {
    setReenviando(true)
    const r = await request(e.origem, e.path, { method: e.method, rawBody: e.requestBody ?? undefined, toast: true })
    setReenviando(false)
    selecionar(r)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Histórico"
        description={`Todas as requisições feitas pelo painel (API e inspetor), exceto o polling automático. Guardado no navegador, até ${HISTORY_LIMIT} itens.`}
        actions={
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={!entries.length}>
                <Trash2 />
                Limpar histórico
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar o histórico?</AlertDialogTitle>
                <AlertDialogDescription>
                  Remove as {entries.length} requisições guardadas neste navegador. Os pedidos no banco não são afetados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    clear()
                    setParams({}, { replace: true })
                  }}
                >
                  Limpar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por caminho" className="pl-8" />
        </div>
        <Select value={origem} onValueChange={setOrigem}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as origens</SelectItem>
            <SelectItem value="api">API de Pedidos</SelectItem>
            <SelectItem value="inspector">Inspetor</SelectItem>
          </SelectContent>
        </Select>
        <Select value={metodo} onValueChange={setMetodo}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os métodos</SelectItem>
            {['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={faixa} onValueChange={(v) => setFaixa(v as Faixa)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos os status</SelectItem>
            <SelectItem value="2xx">2xx · sucesso</SelectItem>
            <SelectItem value="4xx">4xx · erro do cliente</SelectItem>
            <SelectItem value="5xx">5xx · erro do servidor</SelectItem>
            <SelectItem value="rede">Rede · indisponível</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={History} title="Histórico vazio" description="As requisições feitas nas outras páginas aparecem aqui." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="py-0">
            <CardContent className="max-h-[70vh] overflow-y-auto px-0">
              {filtrados.length ? (
                <HistoryList entries={filtrados} selectedId={selecionadoId} onSelect={selecionar} />
              ) : (
                <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma requisição corresponde aos filtros.</p>
              )}
            </CardContent>
          </Card>
          <Card className="h-fit">
            <CardContent>
              {selecionado ? (
                <RequestResponsePanel
                  result={selecionado}
                  actions={
                    <>
                      <Button variant="outline" size="xs" onClick={() => reenviar(selecionado)} disabled={reenviando}>
                        {reenviando ? <Loader2 className="animate-spin" /> : <RotateCw />}
                        Reenviar
                      </Button>
                      <CopyButton
                        variant="outline"
                        label="Copiar como curl"
                        text={toCurl({ origem: selecionado.origem, method: selecionado.method, path: selecionado.path, body: selecionado.requestBody })}
                      />
                    </>
                  }
                />
              ) : (
                <EmptyState icon={History} title="Selecione uma requisição" description="Clique num item da lista para ver requisição e resposta completas." />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
