/** Asserções dos cenários. Funções puras: lançam AssertionFailure com esperado x obtido. */
import type { HttpResult } from '@/lib/http'

export class AssertionFailure extends Error {
  readonly esperado: unknown
  readonly obtido: unknown

  constructor(mensagem: string, esperado?: unknown, obtido?: unknown) {
    super(mensagem)
    this.name = 'AssertionFailure'
    this.esperado = esperado
    this.obtido = obtido
  }
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]))
  const ka = Object.keys(a as object)
  const kb = Object.keys(b as object)
  return (
    ka.length === kb.length &&
    ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  )
}

export function expectStatus(r: Pick<HttpResult, 'status' | 'error' | 'method' | 'path'>, esperado: number, mensagem?: string): void {
  if (r.status !== esperado) {
    throw new AssertionFailure(
      mensagem ?? `${r.method} ${r.path} deveria responder ${esperado}`,
      esperado,
      r.status === null ? `sem resposta (${r.error ?? 'erro de rede'})` : r.status,
    )
  }
}

export function expectEqual(obtido: unknown, esperado: unknown, mensagem: string): void {
  if (!deepEqual(obtido, esperado)) throw new AssertionFailure(mensagem, esperado, obtido)
}

export function expectTrue(condicao: boolean, mensagem: string, detalhes?: { esperado?: unknown; obtido?: unknown }): asserts condicao {
  if (!condicao) throw new AssertionFailure(mensagem, detalhes?.esperado, detalhes?.obtido)
}
