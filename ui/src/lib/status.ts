/** Espelho da máquina de estados da API (app/services/pedido_service.py). */

export const STATUS = ['CRIADO', 'CONFIRMADO', 'CANCELADO'] as const
export type StatusPedido = (typeof STATUS)[number]

export const TRANSICOES: Record<StatusPedido, readonly StatusPedido[]> = {
  CRIADO: ['CONFIRMADO', 'CANCELADO'],
  CONFIRMADO: ['CANCELADO'],
  CANCELADO: [],
}

export function isStatus(valor: unknown): valor is StatusPedido {
  return typeof valor === 'string' && (STATUS as readonly string[]).includes(valor)
}

export function transicaoPermitida(de: StatusPedido, para: StatusPedido): boolean {
  return TRANSICOES[de].includes(para)
}

export function isFinal(status: StatusPedido): boolean {
  return TRANSICOES[status].length === 0
}

/** Todas as transições (de, para), com o código HTTP esperado. */
export function todasTransicoes(): { de: StatusPedido; para: StatusPedido; esperado: 200 | 409 }[] {
  return STATUS.flatMap((de) =>
    STATUS.map((para) => ({ de, para, esperado: transicaoPermitida(de, para) ? (200 as const) : (409 as const) })),
  )
}

export const STATUS_STYLE: Record<StatusPedido, { badge: string; dot: string; stroke: string; fill: string }> = {
  CRIADO: {
    badge: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30',
    dot: 'bg-blue-500',
    stroke: 'stroke-blue-500',
    fill: 'fill-blue-500/15',
  },
  CONFIRMADO: {
    badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30',
    dot: 'bg-emerald-500',
    stroke: 'stroke-emerald-500',
    fill: 'fill-emerald-500/15',
  },
  CANCELADO: {
    badge: 'bg-red-500/15 text-red-600 dark:text-red-400 ring-1 ring-red-500/30',
    dot: 'bg-red-500',
    stroke: 'stroke-red-500',
    fill: 'fill-red-500/15',
  },
}
