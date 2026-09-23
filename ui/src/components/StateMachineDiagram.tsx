import { cn } from 'cn'
import { isFinal, STATUS, STATUS_STYLE, TRANSICOES, transicaoPermitida, type StatusPedido } from '@/lib/status'

const W = 150
const H = 48

const POS: Record<StatusPedido, { x: number; y: number }> = {
  CRIADO: { x: 100, y: 140 },
  CONFIRMADO: { x: 430, y: 55 },
  CANCELADO: { x: 430, y: 225 },
}

/** Ponto na borda do retângulo do estado, na direção de `alvo`. */
function borda(de: StatusPedido, alvo: { x: number; y: number }) {
  const c = POS[de]
  const dx = alvo.x - c.x
  const dy = alvo.y - c.y
  const escala = 1 / Math.max(Math.abs(dx) / (W / 2 + 6), Math.abs(dy) / (H / 2 + 6))
  return { x: c.x + dx * escala, y: c.y + dy * escala }
}

function segmento(de: StatusPedido, para: StatusPedido) {
  const a = borda(de, POS[para])
  const b = borda(para, POS[de])
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }
}

export interface Tentativa {
  de: StatusPedido
  para: StatusPedido
  ok: boolean
  mensagem?: string
}

interface Props {
  atual?: StatusPedido | null
  tentativa?: Tentativa | null
  onSelect?: (status: StatusPedido) => void
  disabled?: boolean
  className?: string
}

export function StateMachineDiagram({ atual, tentativa, onSelect, disabled, className }: Props) {
  const arestas = STATUS.flatMap((de) => TRANSICOES[de].map((para) => ({ de, para })))
  const invalida = tentativa && !tentativa.ok ? tentativa : null

  return (
    <svg viewBox="0 0 560 280" className={cn('w-full select-none', className)} role="img" aria-label="Máquina de estados do pedido">
      <defs>
        {(['muted', 'ativo', 'ok'] as const).map((tipo) => (
          <marker key={tipo} id={`seta-${tipo}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path
              d="M 0 0 L 10 5 L 0 10 z"
              className={tipo === 'ok' ? 'fill-emerald-500' : tipo === 'ativo' ? 'fill-foreground' : 'fill-muted-foreground/50'}
            />
          </marker>
        ))}
      </defs>

      {/* Transições permitidas */}
      {arestas.map(({ de, para }) => {
        const s = segmento(de, para)
        const sucesso = tentativa?.ok && tentativa.de === de && tentativa.para === para
        const disponivel = atual === de
        return (
          <line
            key={`${de}-${para}`}
            {...s}
            strokeWidth={sucesso ? 3 : 2}
            markerEnd={`url(#seta-${sucesso ? 'ok' : disponivel ? 'ativo' : 'muted'})`}
            className={cn(
              'transition-all duration-300',
              sucesso ? 'stroke-emerald-500' : disponivel ? 'stroke-foreground' : 'stroke-muted-foreground/40',
            )}
            strokeDasharray={disponivel && !sucesso ? '6 4' : undefined}
          />
        )
      })}

      {/* Tentativa inválida: linha tracejada vermelha com X */}
      {invalida && invalida.de !== invalida.para && (
        <g className="animate-in fade-in duration-300">
          <line {...segmento(invalida.de, invalida.para)} strokeWidth={2} strokeDasharray="4 4" className="stroke-red-500" />
          <Xis
            x={(POS[invalida.de].x + POS[invalida.para].x) / 2}
            y={(POS[invalida.de].y + POS[invalida.para].y) / 2}
          />
        </g>
      )}

      {/* Estados */}
      {STATUS.map((s) => {
        const { x, y } = POS[s]
        const ehAtual = atual === s
        const clicavel = !!onSelect && !disabled
        const alvoValido = atual ? transicaoPermitida(atual, s) : false
        return (
          <g
            key={s}
            onClick={clicavel ? () => onSelect(s) : undefined}
            className={cn(clicavel && 'cursor-pointer', 'group')}
            role={clicavel ? 'button' : undefined}
            aria-label={clicavel ? `Alterar status para ${s}` : s}
          >
            <rect
              x={x - W / 2}
              y={y - H / 2}
              width={W}
              height={H}
              rx={12}
              strokeWidth={ehAtual ? 3 : 1.5}
              className={cn(
                'transition-all duration-300',
                STATUS_STYLE[s].stroke,
                ehAtual ? STATUS_STYLE[s].fill : 'fill-card',
                clicavel && 'group-hover:brightness-125',
                atual && !ehAtual && !alvoValido && 'opacity-70',
              )}
            />
            {isFinal(s) && (
              <rect
                x={x - W / 2 + 5}
                y={y - H / 2 + 5}
                width={W - 10}
                height={H - 10}
                rx={8}
                strokeWidth={1}
                className={cn('fill-none', STATUS_STYLE[s].stroke)}
              />
            )}
            <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-[13px] font-semibold">
              {s}
            </text>
            {ehAtual && (
              <text x={x} y={y - H / 2 - 9} textAnchor="middle" className="fill-muted-foreground text-[10px] tracking-wider uppercase">
                estado atual
              </text>
            )}
            {isFinal(s) && (
              <text x={x} y={y + H / 2 + 15} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                estado final
              </text>
            )}
            {invalida && invalida.de === invalida.para && invalida.para === s && <Xis x={x + W / 2 - 4} y={y - H / 2 + 4} />}
          </g>
        )
      })}
    </svg>
  )
}

function Xis({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} className="animate-in zoom-in duration-300">
      <circle r={12} className="fill-red-500" />
      <path d="M -5 -5 L 5 5 M 5 -5 L -5 5" strokeWidth={2.5} strokeLinecap="round" className="stroke-white" />
    </g>
  )
}
