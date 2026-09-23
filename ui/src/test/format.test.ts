import { describe, expect, it } from 'vitest'
import { formatBRL, formatBytes, formatDateTime, formatDuration, formatUptime, previewValorTotal } from '@/lib/format'

const nbsp = (s: string) => s.replace(/ /g, ' ')

describe('formatBRL', () => {
  it('formata em reais com separadores brasileiros', () => {
    expect(nbsp(formatBRL(1234.56))).toBe('R$ 1.234,56')
    expect(nbsp(formatBRL(0.5))).toBe('R$ 0,50')
  })
  it('usa travessão para valores ausentes', () => {
    expect(formatBRL(null)).toBe('—')
    expect(formatBRL(undefined)).toBe('—')
  })
})

describe('formatDateTime', () => {
  it('usa dd/MM/yyyy HH:mm:ss no fuso local', () => {
    expect(formatDateTime(new Date(2026, 8, 3, 7, 5, 9))).toBe('03/09/2026 07:05:09')
  })
  it('aceita ISO 8601 com fuso', () => {
    const iso = '2026-09-23T14:30:00.123456Z'
    const d = new Date(iso)
    expect(formatDateTime(iso)).toBe(formatDateTime(d))
  })
  it('devolve o texto original se não for data', () => {
    expect(formatDateTime('abc')).toBe('abc')
    expect(formatDateTime(null)).toBe('—')
  })
})

describe('formatDuration e formatBytes', () => {
  it('ms abaixo de 1 s, segundos com vírgula acima', () => {
    expect(formatDuration(120)).toBe('120 ms')
    expect(formatDuration(1340)).toBe('1,3 s')
  })
  it('bytes e KB', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
  })
})

describe('formatUptime', () => {
  const agora = Date.parse('2026-09-23T12:00:00Z')
  it('compacta em d/h/m/s', () => {
    expect(formatUptime('2026-09-23T11:59:15Z', agora)).toBe('45s')
    expect(formatUptime('2026-09-23T11:54:48Z', agora)).toBe('5m 12s')
    expect(formatUptime('2026-09-23T09:57:00Z', agora)).toBe('2h 3m')
    expect(formatUptime('2026-09-21T09:00:00Z', agora)).toBe('2d 3h')
  })
  it('trata valores ausentes ou zerados do Docker', () => {
    expect(formatUptime(null, agora)).toBe('—')
    expect(formatUptime('0001-01-01T00:00:00Z', agora)).toBe('—')
  })
})

describe('previewValorTotal (mesma regra da API)', () => {
  it('calcula sem erro de ponto flutuante', () => {
    expect(previewValorTotal('3', '0.35')).toBe(1.05)
    expect(previewValorTotal('7', '1.15')).toBe(8.05)
    expect(previewValorTotal('2', '149.90')).toBe(299.8)
  })
  it('arredonda com ROUND_HALF_UP', () => {
    expect(previewValorTotal('3', '0.335')).toBe(1.01)
  })
  it('aceita vírgula decimal', () => {
    expect(previewValorTotal('2', '10,5')).toBe(21)
  })
  it('retorna null para entradas não numéricas', () => {
    expect(previewValorTotal('2.5', '10')).toBeNull()
    expect(previewValorTotal('', '10')).toBeNull()
    expect(previewValorTotal('2', 'abc')).toBeNull()
  })
})
