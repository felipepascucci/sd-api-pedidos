import { toast } from 'sonner'
import { extractDetail, type HttpResult } from '@/lib/http'

/** Toast padronizado: código HTTP + mensagem (sucesso ou `detail` do erro). */
export function notifyResult(result: HttpResult, successMsg?: string) {
  const titulo = `${result.method} ${result.path}`
  if (result.status === null || result.unavailable) {
    toast.error(`${titulo} · ${result.status ?? 'rede'}`, { description: result.error ?? 'Serviço indisponível' })
    return
  }
  const codigo = `${result.status} ${result.statusText}`.trim()
  if (result.ok) {
    toast.success(`${codigo}`, { description: successMsg ?? titulo })
    return
  }
  const detalhe = extractDetail(result.body) ?? titulo
  if (result.status >= 500) toast.error(codigo, { description: detalhe })
  else toast.warning(codigo, { description: detalhe })
}
