import { describe, expect, it } from 'vitest'
import { AssertionFailure, deepEqual, expectEqual, expectStatus, expectTrue } from '@/scenarios/assertions'

const resp = (status: number | null) => ({ status, error: status === null ? 'Erro de rede: Failed to fetch' : null, method: 'GET' as const, path: '/health' })

function capturar(fn: () => void): AssertionFailure {
  try {
    fn()
  } catch (e) {
    if (e instanceof AssertionFailure) return e
    throw e
  }
  throw new Error('Esperava AssertionFailure')
}

describe('deepEqual', () => {
  it('compara objetos e listas estruturalmente', () => {
    expect(deepEqual({ a: 1, b: [1, { c: 'x' }] }, { b: [1, { c: 'x' }], a: 1 })).toBe(true)
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false)
    expect(deepEqual([1, 2], [2, 1])).toBe(false)
    expect(deepEqual(null, {})).toBe(false)
    expect(deepEqual(299.8, 299.8)).toBe(true)
  })
})

describe('expectStatus', () => {
  it('passa quando o status confere', () => {
    expect(() => expectStatus(resp(200), 200)).not.toThrow()
  })
  it('falha com esperado x obtido', () => {
    const e = capturar(() => expectStatus(resp(422), 201))
    expect(e.esperado).toBe(201)
    expect(e.obtido).toBe(422)
    expect(e.message).toContain('GET /health')
  })
  it('explica quando não houve resposta', () => {
    const e = capturar(() => expectStatus(resp(null), 200))
    expect(String(e.obtido)).toContain('sem resposta')
  })
})

describe('expectEqual e expectTrue', () => {
  it('expectEqual usa comparação profunda', () => {
    expect(() => expectEqual({ status: 'ok' }, { status: 'ok' }, 'corpo')).not.toThrow()
    const e = capturar(() => expectEqual({ status: 'erro' }, { status: 'ok' }, 'corpo'))
    expect(e.esperado).toEqual({ status: 'ok' })
    expect(e.obtido).toEqual({ status: 'erro' })
  })
  it('expectTrue carrega detalhes opcionais', () => {
    expect(() => expectTrue(true, 'ok')).not.toThrow()
    const e = capturar(() => expectTrue(false, 'lista ordenada', { esperado: [1, 2], obtido: [2, 1] }))
    expect(e.message).toBe('lista ordenada')
    expect(e.obtido).toEqual([2, 1])
  })
})
