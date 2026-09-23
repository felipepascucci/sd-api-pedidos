/** Clientes tipados do inspetor (via proxy /inspector). */
import { request, type RequestOptions } from '@/lib/http'

export interface DbInfo {
  versao: string
  versao_completa: string
  banco: string
  tamanho: string
  conexoes_ativas: number
  conexoes_total: number
  default_transaction_read_only: string
  horario_servidor: string
}

export interface Tabela {
  nome: string
  linhas: number
}

export interface Coluna {
  nome: string
  tipo: string
  nullable: boolean
  default: string | null
  posicao: number
}

export interface TabelaSchema {
  tabela: string
  colunas: Coluna[]
  constraints: { nome: string; tipo: string; definicao: string }[]
  indices: { nome: string; definicao: string }[]
}

export type Linha = Record<string, string | number | boolean | null>

export interface Linhas {
  columns: string[]
  rows: Linha[]
  total: number
}

export interface ContainerInfo {
  servico: string
  nome: string
  estado: string
  health: string | null
  started_at: string | null
  imagem: string
  restart_count: number
  portas: { container: string; host: number }[]
  controlavel: boolean
}

export interface RestartResult {
  servico: string
  started_at: string
  duracao_ms: number
  containers: { nome: string; started_at: string }[]
}

export interface Logs {
  servico: string
  container: string
  tail: number
  linhas: { timestamp: string; mensagem: string }[]
}

export interface RowsQuery {
  limit?: number
  offset?: number
  order_by?: string
  direction?: 'asc' | 'desc'
}

type Opts = Pick<RequestOptions, 'silent' | 'toast'>

export const inspectorApi = {
  health: (opts: Opts = {}) => request<{ status: string }>('inspector', '/health', opts),

  dbInfo: (opts: Opts = {}) => request<DbInfo>('inspector', '/db/info', opts),

  tabelas: (opts: Opts = {}) => request<Tabela[]>('inspector', '/db/tables', opts),

  schema: (tabela: string, opts: Opts = {}) =>
    request<TabelaSchema>('inspector', `/db/tables/${encodeURIComponent(tabela)}/schema`, opts),

  linhas: (tabela: string, q: RowsQuery = {}, opts: Opts = {}) => {
    const params = new URLSearchParams()
    if (q.limit !== undefined) params.set('limit', String(q.limit))
    if (q.offset !== undefined) params.set('offset', String(q.offset))
    if (q.order_by) params.set('order_by', q.order_by)
    if (q.direction) params.set('direction', q.direction)
    const qs = params.toString()
    return request<Linhas>('inspector', `/db/tables/${encodeURIComponent(tabela)}/rows${qs ? `?${qs}` : ''}`, opts)
  },

  containers: (opts: Opts = {}) => request<ContainerInfo[]>('inspector', '/docker/containers', opts),

  reiniciar: (servico: string, opts: Opts = {}) =>
    request<RestartResult>('inspector', `/docker/containers/${encodeURIComponent(servico)}/restart`, {
      ...opts,
      method: 'POST',
    }),

  logs: (servico: string, tail: number, opts: Opts = {}) =>
    request<Logs>('inspector', `/docker/containers/${encodeURIComponent(servico)}/logs?tail=${tail}`, opts),
}
