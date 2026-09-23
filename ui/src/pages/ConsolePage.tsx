import { useState } from 'react'
import { AlertTriangle, Braces, Loader2, Send, Terminal } from 'lucide-react'
import { CopyButton } from '@/components/CopyButton'
import { EmptyState, PageHeader } from '@/components/common'
import { RequestResponsePanel } from '@/components/RequestResponsePanel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toCurl } from '@/lib/curl'
import type { HttpMethod, HttpResult } from '@/lib/http'
import { pedidosApi } from '@/lib/pedidos-api'

const METODOS: HttpMethod[] = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']

interface Preset {
  id: string
  label: string
  method: HttpMethod
  path: string
  body?: unknown
}

const PRESETS: Preset[] = [
  { id: 'health', label: 'GET /health — saúde', method: 'GET', path: '/health' },
  { id: 'listar', label: 'GET /pedidos — listar', method: 'GET', path: '/pedidos' },
  { id: 'consultar', label: 'GET /pedidos/{id} — consultar', method: 'GET', path: '/pedidos/1' },
  {
    id: 'criar',
    label: 'POST /pedidos — criar (válido)',
    method: 'POST',
    path: '/pedidos',
    body: { cliente: 'Maria Silva', produto: 'Teclado', quantidade: 2, valor_unitario: 149.9 },
  },
  {
    id: 'criar-invalido',
    label: 'POST /pedidos — criar (inválido → 422)',
    method: 'POST',
    path: '/pedidos',
    body: { cliente: '   ', produto: 'Teclado', quantidade: 0, valor_unitario: 10.999, status: 'CONFIRMADO' },
  },
  { id: 'status', label: 'PATCH /pedidos/{id}/status — alterar status', method: 'PATCH', path: '/pedidos/1/status', body: { status: 'CONFIRMADO' } },
  { id: 'delete', label: 'DELETE /pedidos/{id} — método não suportado (405)', method: 'DELETE', path: '/pedidos/1' },
]

const semCorpo = (m: HttpMethod) => m === 'GET'

function jsonValido(texto: string): boolean {
  if (!texto.trim()) return true
  try {
    JSON.parse(texto)
    return true
  } catch {
    return false
  }
}

export function ConsolePage() {
  const [preset, setPreset] = useState('criar')
  const [method, setMethod] = useState<HttpMethod>('POST')
  const [path, setPath] = useState('/pedidos')
  const [body, setBody] = useState(JSON.stringify(PRESETS[3].body, null, 2))
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<HttpResult | null>(null)

  const aplicarPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)
    if (!p) return
    setPreset(id)
    setMethod(p.method)
    setPath(p.path)
    setBody(p.body === undefined ? '' : JSON.stringify(p.body, null, 2))
  }

  const caminho = path.startsWith('/') ? path : `/${path}`
  const valido = jsonValido(body)
  const corpoEfetivo = semCorpo(method) || !body.trim() ? null : body

  const formatar = () => {
    try {
      setBody(JSON.stringify(JSON.parse(body), null, 2))
    } catch {
      /* botão fica desabilitado quando inválido */
    }
  }

  const enviar = async () => {
    setEnviando(true)
    const r = await pedidosApi.livre(method, caminho, corpoEfetivo, { toast: true })
    setResultado(r)
    setEnviando(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Console de API"
        description="Monte qualquer requisição para a API de Pedidos e veja a resposta completa. Nada é validado antes do envio: o objetivo é ver como a API reage."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Requisição</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Preset</Label>
              <Select value={preset} onValueChange={aplicarPreset}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Select value={method} onValueChange={(v) => setMethod(v as HttpMethod)}>
                <SelectTrigger className="w-28 font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METODOS.map((m) => (
                    <SelectItem key={m} value={m} className="font-mono">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex min-w-0 flex-1 items-center rounded-lg border bg-muted/30 pl-2.5 focus-within:ring-2 focus-within:ring-ring/40">
                <span className="font-mono text-xs text-muted-foreground">/api</span>
                <Input
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && enviar()}
                  className="border-0 bg-transparent pl-0.5 font-mono shadow-none focus-visible:ring-0 dark:bg-transparent"
                  aria-label="Caminho"
                />
              </div>
            </div>

            {semCorpo(method) ? (
              <p className="text-xs text-muted-foreground">Requisições GET não levam corpo.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="corpo">Corpo (JSON)</Label>
                  <Button variant="ghost" size="xs" onClick={formatar} disabled={!valido || !body.trim()}>
                    <Braces />
                    Formatar
                  </Button>
                </div>
                <Textarea
                  id="corpo"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  spellCheck={false}
                  className="min-h-48 font-mono text-xs"
                  aria-invalid={!valido}
                />
                {!valido && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="size-3.5" />
                    JSON inválido. Você pode enviar mesmo assim: o texto vai cru, para ver como a API responde.
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={enviar} disabled={enviando}>
                {enviando ? <Loader2 className="animate-spin" /> : <Send />}
                Enviar
              </Button>
              <CopyButton
                variant="outline"
                size="sm"
                label="Copiar como curl"
                text={() => toCurl({ origem: 'api', method, path: caminho, body: corpoEfetivo })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resposta</CardTitle>
          </CardHeader>
          <CardContent>
            {resultado ? (
              <RequestResponsePanel
                result={resultado}
                bodyMaxHeight="24rem"
                actions={<CopyButton text={resultado.rawBody} label="Copiar resposta" />}
              />
            ) : (
              <EmptyState icon={Terminal} title="Nenhuma resposta ainda" description="Escolha um preset ou monte a requisição e clique em Enviar." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
