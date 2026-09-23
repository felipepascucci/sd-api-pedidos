/**
 * Wrapper único de fetch. TODA chamada da UI (API e inspetor) passa por aqui.
 *
 * - Nunca lança exceção por status HTTP: devolve sempre um HttpResult.
 * - Erro de rede e 502/504 do nginx (upstream fora) viram `unavailable: true`.
 * - Registra a chamada no histórico, exceto quando `silent` (polling).
 */
import { useHistory } from '@/stores/history'
import { notifyResult } from '@/lib/notify'

export type Origem = 'api' | 'inspector'
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export const BASES: Record<Origem, string> = {
  api: '/api',
  inspector: '/inspector',
}

export interface HttpResult<T = unknown> {
  id: string
  origem: Origem
  method: HttpMethod
  /** Caminho relativo ao serviço (ex.: /pedidos/1), sem o prefixo do proxy. */
  path: string
  /** URL efetivamente chamada no navegador (ex.: /api/pedidos/1). */
  url: string
  /** Corpo enviado, exatamente como texto. */
  requestBody: string | null
  status: number | null
  statusText: string
  ok: boolean
  /** Upstream fora do ar: erro de rede ou 502/504 gerado pelo nginx. */
  unavailable: boolean
  responseHeaders: Record<string, string>
  /** Corpo interpretado: JSON quando possível, senão texto. */
  body: T | null
  rawBody: string
  isJson: boolean
  error: string | null
  durationMs: number
  size: number
  timestamp: string
}

export interface RequestOptions {
  method?: HttpMethod
  /** Objeto serializado como JSON. */
  json?: unknown
  /** Texto enviado cru (permite testar JSON inválido). */
  rawBody?: string
  /** Não registra no histórico nem dispara toast (polling). */
  silent?: boolean
  /** Dispara toast com o código e a mensagem. */
  toast?: boolean | { success?: string }
}

let seq = 0
const newId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`

export async function request<T = unknown>(
  origem: Origem,
  path: string,
  opts: RequestOptions = {},
): Promise<HttpResult<T>> {
  const method = opts.method ?? 'GET'
  const url = `${BASES[origem]}${path}`
  const requestBody =
    opts.rawBody !== undefined ? opts.rawBody : opts.json !== undefined ? JSON.stringify(opts.json) : null

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (requestBody !== null) headers['Content-Type'] = 'application/json'

  const inicio = performance.now()
  const base = {
    id: newId(),
    origem,
    method,
    path,
    url,
    requestBody,
    timestamp: new Date().toISOString(),
  }

  let result: HttpResult<T>
  try {
    const resp = await fetch(url, { method, headers, body: requestBody ?? undefined })
    const rawBody = await resp.text()
    const durationMs = Math.round(performance.now() - inicio)
    const responseHeaders: Record<string, string> = {}
    resp.headers.forEach((v, k) => {
      responseHeaders[k] = v
    })
    const contentType = resp.headers.get('content-type') ?? ''
    let body: unknown = rawBody || null
    let isJson = false
    if (contentType.includes('application/json') && rawBody) {
      try {
        body = JSON.parse(rawBody)
        isJson = true
      } catch {
        /* mantém como texto */
      }
    }
    // 502/504 com corpo não-JSON vêm do nginx: o serviço de destino está fora.
    const unavailable = (resp.status === 502 || resp.status === 504) && !isJson
    result = {
      ...base,
      status: resp.status,
      statusText: resp.statusText,
      ok: resp.ok,
      unavailable,
      responseHeaders,
      body: body as T,
      rawBody,
      isJson,
      error: unavailable
        ? `${origem === 'api' ? 'API de Pedidos' : 'Inspetor'} indisponível (o proxy não alcançou o serviço)`
        : null,
      durationMs,
      size: new TextEncoder().encode(rawBody).length,
    }
  } catch (e) {
    result = {
      ...base,
      status: null,
      statusText: '',
      ok: false,
      unavailable: true,
      responseHeaders: {},
      body: null,
      rawBody: '',
      isJson: false,
      error: `Erro de rede: ${e instanceof Error ? e.message : String(e)}`,
      durationMs: Math.round(performance.now() - inicio),
      size: 0,
    }
  }

  if (!opts.silent) {
    useHistory.getState().add(result as HttpResult)
    if (opts.toast) {
      notifyResult(result, typeof opts.toast === 'object' ? opts.toast.success : undefined)
    }
  }
  return result
}

/** Formato de erro 422 do FastAPI/Pydantic. */
export interface ValidationIssue {
  loc: (string | number)[]
  msg: string
  type: string
}

export function validationIssues(body: unknown): ValidationIssue[] {
  if (body && typeof body === 'object' && Array.isArray((body as { detail?: unknown }).detail)) {
    return (body as { detail: ValidationIssue[] }).detail
  }
  return []
}

/** Extrai uma mensagem legível do corpo de erro da API. */
export function extractDetail(body: unknown): string | null {
  if (!body || typeof body !== 'object') return typeof body === 'string' && body ? body.slice(0, 200) : null
  const detail = (body as { detail?: unknown }).detail
  if (typeof detail === 'string') return detail
  const issues = validationIssues(body)
  if (issues.length) {
    return issues
      .map((i) => {
        const campo = i.loc.filter((p) => p !== 'body').join('.')
        return campo ? `${campo}: ${i.msg}` : i.msg
      })
      .join('; ')
  }
  return null
}
