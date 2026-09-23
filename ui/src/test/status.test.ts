import { describe, expect, it } from 'vitest'
import { isFinal, isStatus, STATUS, todasTransicoes, transicaoPermitida, TRANSICOES } from '@/lib/status'

describe('máquina de estados (espelho da API)', () => {
  it('permite exatamente as três transições da API', () => {
    const permitidas = todasTransicoes()
      .filter((t) => t.esperado === 200)
      .map((t) => `${t.de}->${t.para}`)
    expect(permitidas.sort()).toEqual(['CONFIRMADO->CANCELADO', 'CRIADO->CANCELADO', 'CRIADO->CONFIRMADO'])
  })

  it('rejeita qualquer saída de CANCELADO', () => {
    for (const para of STATUS) expect(transicaoPermitida('CANCELADO', para)).toBe(false)
  })

  it('rejeita ir para CRIADO e repetir o mesmo status', () => {
    for (const de of STATUS) {
      expect(transicaoPermitida(de, 'CRIADO')).toBe(false)
      expect(transicaoPermitida(de, de)).toBe(false)
    }
  })

  it('gera as 9 combinações com 3 permitidas (200) e 6 proibidas (409)', () => {
    const todas = todasTransicoes()
    expect(todas).toHaveLength(9)
    expect(todas.filter((t) => t.esperado === 409)).toHaveLength(6)
  })

  it('CANCELADO é o único estado final', () => {
    expect(STATUS.filter(isFinal)).toEqual(['CANCELADO'])
    expect(TRANSICOES.CANCELADO).toEqual([])
  })

  it('isStatus reconhece só os valores do enum', () => {
    expect(isStatus('CRIADO')).toBe(true)
    expect(isStatus('ENVIADO')).toBe(false)
    expect(isStatus(1)).toBe(false)
  })
})
