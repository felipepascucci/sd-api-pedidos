/** Executor de cenários: cada chamada feita pelo cenário é gravada como "passo". */
import type { HttpResult } from '@/lib/http'
import { inspectorApi } from '@/lib/inspector-api'
import { pedidosApi, type Pedido } from '@/lib/pedidos-api'
import type { StatusPedido } from '@/lib/status'
import { AssertionFailure, expectStatus } from '@/scenarios/assertions'

export const PREFIXO_TESTE = '[teste-ui]'

type AsyncFn = (...args: never[]) => Promise<HttpResult<unknown>>

/** Envolve cada função do cliente para registrar o resultado em `passos`. */
function gravar<T extends Record<string, AsyncFn>>(cliente: T, passos: HttpResult[]): T {
  return Object.fromEntries(
    Object.entries(cliente).map(([nome, fn]) => [
      nome,
      async (...args: never[]) => {
        const r = await fn(...args)
        passos.push(r)
        return r
      },
    ]),
  ) as T
}

export function criarContexto(nomeCenario: string) {
  const passos: HttpResult[] = []
  const api = gravar(pedidosApi, passos)
  const inspector = gravar(inspectorApi, passos)
  const cliente = `${PREFIXO_TESTE} ${nomeCenario}`

  const corpoValido = (extra: Record<string, unknown> = {}) => ({
    cliente,
    produto: 'Produto de teste',
    quantidade: 2,
    valor_unitario: 149.9,
    ...extra,
  })

  /** Cria um pedido válido; falha o cenário se a criação não der 201. */
  const criarPedido = async (extra: Record<string, unknown> = {}): Promise<Pedido> => {
    const r = await api.criar(corpoValido(extra))
    expectStatus(r, 201, 'Pré-condição: criar pedido válido deveria responder 201')
    return r.body as Pedido
  }

  /** Cria um pedido e o leva até `status` por transições válidas. */
  const pedidoNoStatus = async (status: StatusPedido): Promise<Pedido> => {
    let pedido = await criarPedido()
    if (status !== 'CRIADO') {
      const r = await api.alterarStatus(pedido.id, { status })
      expectStatus(r, 200, `Pré-condição: levar o pedido até ${status} deveria responder 200`)
      pedido = r.body as Pedido
    }
    return pedido
  }

  return { passos, api, inspector, cliente, corpoValido, criarPedido, pedidoNoStatus }
}

export type ScenarioContext = ReturnType<typeof criarContexto>

export interface Scenario {
  id: string
  grupo: string
  nome: string
  descricao: string
  esperado: string
  run: (ctx: ScenarioContext) => Promise<void>
}

export type ScenarioStatus = 'passou' | 'falhou' | 'erro'

export interface ScenarioResult {
  status: ScenarioStatus
  passos: HttpResult[]
  falha?: { mensagem: string; esperado?: unknown; obtido?: unknown }
  durationMs: number
}

export async function runScenario(s: Scenario): Promise<ScenarioResult> {
  const ctx = criarContexto(s.nome)
  const inicio = performance.now()
  try {
    await s.run(ctx)
    return { status: 'passou', passos: ctx.passos, durationMs: Math.round(performance.now() - inicio) }
  } catch (e) {
    const durationMs = Math.round(performance.now() - inicio)
    if (e instanceof AssertionFailure) {
      return { status: 'falhou', passos: ctx.passos, durationMs, falha: { mensagem: e.message, esperado: e.esperado, obtido: e.obtido } }
    }
    return { status: 'erro', passos: ctx.passos, durationMs, falha: { mensagem: e instanceof Error ? e.message : String(e) } }
  }
}
