import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Calculator, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { formatBRL, previewValorTotal } from '@/lib/format'
import { validationIssues } from '@/lib/http'
import { pedidosApi, type Pedido } from '@/lib/pedidos-api'

const CAMPOS = ['cliente', 'produto', 'quantidade', 'valor_unitario'] as const
type Campo = (typeof CAMPOS)[number]
type Valores = Record<Campo, string>
type Erros = Partial<Record<Campo | '_geral', string[]>>

const VAZIO: Valores = { cliente: '', produto: '', quantidade: '', valor_unitario: '' }

const ROTULOS: Record<Campo, string> = {
  cliente: 'Cliente',
  produto: 'Produto',
  quantidade: 'Quantidade',
  valor_unitario: 'Valor unitário',
}

/**
 * Monta o corpo exatamente a partir do que foi digitado: campo vazio é omitido,
 * número vira número e o resto vai como string. Assim a API recebe o dado "real".
 */
export function montarCorpo(v: Valores): Record<string, unknown> {
  const corpo: Record<string, unknown> = {}
  if (v.cliente !== '') corpo.cliente = v.cliente
  if (v.produto !== '') corpo.produto = v.produto
  for (const campo of ['quantidade', 'valor_unitario'] as const) {
    const bruto = v[campo].trim()
    if (bruto === '') continue
    const normalizado = bruto.replace(',', '.')
    corpo[campo] = /^-?\d+(\.\d+)?$/.test(normalizado) ? Number(normalizado) : bruto
  }
  return corpo
}

/** Validação local opcional, espelhando as regras da API. */
export function validarLocal(v: Valores): Erros {
  const erros: Erros = {}
  for (const campo of ['cliente', 'produto'] as const) {
    const t = v[campo].trim()
    if (!t) erros[campo] = ['Obrigatório (não pode ser vazio ou só espaços)']
    else if (t.length > 255) erros[campo] = ['Máximo de 255 caracteres']
  }
  const q = v.quantidade.trim()
  if (!q) erros.quantidade = ['Obrigatório']
  else if (!/^\d+$/.test(q) || Number(q) <= 0) erros.quantidade = ['Deve ser um inteiro maior que 0']
  const vu = v.valor_unitario.trim().replace(',', '.')
  if (!vu) erros.valor_unitario = ['Obrigatório']
  else if (!/^\d+(\.\d+)?$/.test(vu) || Number(vu) <= 0) erros.valor_unitario = ['Deve ser um número maior que 0']
  else if ((vu.split('.')[1] ?? '').length > 2) erros.valor_unitario = ['No máximo 2 casas decimais']
  return erros
}

export function NovoPedidoDialog({ onCreated }: { onCreated?: (p: Pedido) => void }) {
  const queryClient = useQueryClient()
  const [aberto, setAberto] = useState(false)
  const [valores, setValores] = useState<Valores>(VAZIO)
  const [erros, setErros] = useState<Erros>({})
  const [validar, setValidar] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const previa = previewValorTotal(valores.quantidade, valores.valor_unitario)

  const set = (campo: Campo, valor: string) => {
    setValores((v) => ({ ...v, [campo]: valor }))
    setErros((e) => ({ ...e, [campo]: undefined }))
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (validar) {
      const locais = validarLocal(valores)
      if (Object.keys(locais).length) {
        setErros(locais)
        return
      }
    }
    setEnviando(true)
    const r = await pedidosApi.criar(montarCorpo(valores), { toast: { success: 'Pedido criado' } })
    setEnviando(false)
    if (r.status === 201 && r.body) {
      await queryClient.invalidateQueries({ queryKey: ['pedidos'] })
      setAberto(false)
      setValores(VAZIO)
      setErros({})
      onCreated?.(r.body)
      return
    }
    // 422: cada item tem loc = ["body", "<campo>"]; o resto vai para a mensagem geral.
    const novos: Erros = {}
    for (const issue of validationIssues(r.body)) {
      const campo = issue.loc[1]
      const chave = typeof campo === 'string' && (CAMPOS as readonly string[]).includes(campo) ? (campo as Campo) : '_geral'
      const msg = chave === '_geral' && campo !== undefined ? `${String(campo)}: ${issue.msg}` : issue.msg
      novos[chave] = [...(novos[chave] ?? []), msg]
    }
    if (!Object.keys(novos).length && !r.ok) novos._geral = [r.error ?? `Erro ${r.status}`]
    setErros(novos)
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v)
        if (!v) setErros({})
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          Novo pedido
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo pedido</DialogTitle>
          <DialogDescription>
            O que for digitado é enviado como está para <code className="text-xs">POST /pedidos</code>. Campos vazios são omitidos, para ver as validações da API.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
          {CAMPOS.map((campo) => (
            <div key={campo} className="flex flex-col gap-1.5">
              <Label htmlFor={campo}>{ROTULOS[campo]}</Label>
              <Input
                id={campo}
                value={valores[campo]}
                onChange={(e) => set(campo, e.target.value)}
                inputMode={campo === 'quantidade' ? 'numeric' : campo === 'valor_unitario' ? 'decimal' : undefined}
                placeholder={{ cliente: 'Maria Silva', produto: 'Teclado', quantidade: '2', valor_unitario: '149.90' }[campo]}
                aria-invalid={!!erros[campo]}
                className={campo === 'quantidade' || campo === 'valor_unitario' ? 'font-mono' : undefined}
              />
              {erros[campo]?.map((m) => (
                <p key={m} className="text-xs text-destructive">
                  {m}
                </p>
              ))}
            </div>
          ))}

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Calculator className="size-4" />
              Prévia do valor total
            </span>
            <span className="font-mono font-medium">{previa === null ? '—' : formatBRL(previa)}</span>
          </div>
          <p className="-mt-2 text-[11px] text-muted-foreground">Apenas informativa: quem calcula o valor_total de verdade é a API (ROUND_HALF_UP).</p>

          {erros._geral && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {erros._geral.map((m) => (
                <p key={m}>{m}</p>
              ))}
            </div>
          )}

          <DialogFooter className="items-center sm:justify-between">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={validar} onCheckedChange={setValidar} />
              Validar antes de enviar
            </label>
            <Button type="submit" disabled={enviando}>
              {enviando && <Loader2 className="animate-spin" />}
              Criar pedido
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
