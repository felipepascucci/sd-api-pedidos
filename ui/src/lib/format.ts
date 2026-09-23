const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatBRL(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—'
  return brl.format(valor)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** dd/MM/yyyy HH:mm:ss no fuso local. */
export function formatDateTime(valor: string | number | Date | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  const d = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(d.getTime())) return String(valor)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function formatTime(valor: string | number | Date): string {
  const d = valor instanceof Date ? valor : new Date(valor)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB`
}

/** Tempo decorrido desde `startedAt`, compacto (ex.: 2d 3h, 5m 12s). */
export function formatUptime(startedAt: string | null | undefined, agora: number = Date.now()): string {
  if (!startedAt) return '—'
  const inicio = new Date(startedAt).getTime()
  if (Number.isNaN(inicio) || inicio <= 0) return '—'
  let s = Math.max(0, Math.floor((agora - inicio) / 1000))
  const d = Math.floor(s / 86400)
  s -= d * 86400
  const h = Math.floor(s / 3600)
  s -= h * 3600
  const m = Math.floor(s / 60)
  s -= m * 60
  if (d) return `${d}d ${h}h`
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m ${s}s`
  return `${s}s`
}

/**
 * Prévia do valor_total com a mesma regra da API (ROUND_HALF_UP em 2 casas),
 * usando aritmética inteira para evitar erros de ponto flutuante.
 * Retorna null se a entrada não for numérica.
 */
export function previewValorTotal(quantidade: string, valorUnitario: string): number | null {
  const q = quantidade.trim()
  const v = valorUnitario.trim().replace(',', '.')
  if (!/^-?\d+$/.test(q) || !/^-?\d+(\.\d+)?$/.test(v)) return null
  const [inteiro, frac = ''] = v.replace('-', '').split('.')
  const negativo = (q.startsWith('-') ? 1 : 0) ^ (v.startsWith('-') ? 1 : 0)
  const escala = 10n ** BigInt(frac.length)
  const produto = BigInt(q.replace('-', '')) * BigInt(inteiro + frac)
  // centavos = round_half_up(produto * 100 / escala)
  const centavos = (produto * 200n + escala) / (2n * escala)
  const valor = Number(centavos) / 100
  return negativo ? -valor : valor
}
