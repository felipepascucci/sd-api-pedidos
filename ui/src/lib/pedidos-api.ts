/** Clientes tipados da API de Pedidos (via proxy /api). */
import { request, type HttpMethod, type RequestOptions } from '@/lib/http'
import type { StatusPedido } from '@/lib/status'

export interface Pedido {
  id: number
  cliente: string
  produto: string
  quantidade: number
  valor_unitario: number
  valor_total: number
  status: StatusPedido
  data_criacao: string
}

export interface ErroApi {
  detail: unknown
}

type Opts = Pick<RequestOptions, 'silent' | 'toast'>

export const pedidosApi = {
  health: (opts: Opts = {}) => request<{ status: string }>('api', '/health', opts),

  listar: (opts: Opts = {}) => request<Pedido[]>('api', '/pedidos', opts),

  consultar: (id: number | string, opts: Opts = {}) =>
    request<Pedido>('api', `/pedidos/${encodeURIComponent(String(id))}`, opts),

  /** Aceita qualquer corpo, de propósito: a UI deve conseguir enviar dados inválidos. */
  criar: (corpo: unknown, opts: Opts = {}) =>
    request<Pedido>('api', '/pedidos', { ...opts, method: 'POST', json: corpo }),

  criarRaw: (rawBody: string, opts: Opts = {}) =>
    request<Pedido>('api', '/pedidos', { ...opts, method: 'POST', rawBody }),

  alterarStatus: (id: number | string, corpo: unknown, opts: Opts = {}) =>
    request<Pedido>('api', `/pedidos/${encodeURIComponent(String(id))}/status`, {
      ...opts,
      method: 'PATCH',
      json: corpo,
    }),

  /** Chamada livre (Console de API). */
  livre: (method: HttpMethod, path: string, rawBody: string | null, opts: Opts = {}) =>
    request('api', path, { ...opts, method, rawBody: rawBody ?? undefined }),
}
