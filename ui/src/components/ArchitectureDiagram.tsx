import type { LucideIcon } from 'lucide-react'
import { ArrowDown, ArrowRight, Database, HardDrive, Monitor, ScanSearch, Server } from 'lucide-react'
import { cn } from 'cn'
import { HealthDot } from '@/components/common'
import { SAUDE_STYLE, type Saude } from '@/lib/queries'

function No({ icon: Icon, titulo, subtitulo, saude, detalhe }: { icon: LucideIcon; titulo: string; subtitulo: string; saude: Saude; detalhe?: string }) {
  return (
    <div
      className={cn(
        'relative flex min-w-0 flex-1 flex-col gap-1 rounded-xl border bg-card px-3.5 py-3 ring-1 ring-transparent transition-all duration-500',
        saude !== 'carregando' && SAUDE_STYLE[saude].ring,
        saude === 'fora' && 'bg-red-500/5',
        saude === 'degradado' && 'bg-amber-500/5',
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <span className="truncate text-sm font-semibold">{titulo}</span>
        <HealthDot saude={saude} className="ml-auto" />
      </div>
      <span className="truncate font-mono text-[11px] text-muted-foreground">{subtitulo}</span>
      {detalhe && <span className={cn('text-[11px]', SAUDE_STYLE[saude].text)}>{detalhe}</span>}
    </div>
  )
}

function Seta({ rotulo, ativa }: { rotulo: string; ativa: boolean }) {
  return (
    <div className={cn('flex shrink-0 flex-col items-center justify-center gap-0.5 px-1 py-1 text-center md:w-28', ativa ? 'text-foreground' : 'text-muted-foreground/40')}>
      <ArrowRight className="hidden size-5 md:block" />
      <ArrowDown className="size-5 md:hidden" />
      <span className="text-[10px] leading-tight text-muted-foreground">{rotulo}</span>
    </div>
  )
}

interface Props {
  api: Saude
  postgres: Saude
  inspector: Saude
}

export function ArchitectureDiagram({ api, postgres, inspector }: Props) {
  const volume: Saude = postgres === 'carregando' ? 'carregando' : postgres === 'fora' ? 'degradado' : 'ok'
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col items-stretch md:flex-row md:items-center">
        <No icon={Monitor} titulo="Navegador" subtitulo="localhost:3000 → /api" saude="ok" />
        <Seta rotulo="HTTP/JSON" ativa={api === 'ok'} />
        <No icon={Server} titulo="pedidos" subtitulo="FastAPI · :8000 publicada" saude={api} detalhe={SAUDE_STYLE[api].label} />
        <Seta rotulo="protocolo PostgreSQL" ativa={api === 'ok' && postgres === 'ok'} />
        <No icon={Database} titulo="postgres" subtitulo="PostgreSQL · sem porta no host" saude={postgres} detalhe={SAUDE_STYLE[postgres].label} />
      </div>
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-dashed px-3.5 py-2.5 text-xs text-muted-foreground">
          <ScanSearch className="size-4 shrink-0" />
          <span>
            <span className="font-medium text-foreground">inspector</span> lê o banco em modo somente leitura e consulta o Docker (painel apenas)
          </span>
          <HealthDot saude={inspector} className="ml-auto" pulse={false} />
        </div>
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-dashed px-3.5 py-2.5 text-xs text-muted-foreground md:max-w-sm">
          <HardDrive className="size-4 shrink-0" />
          <span>
            volume <span className="font-mono text-foreground">postgres_data</span>: arquivos do banco, independentes dos containers
          </span>
          <HealthDot saude={volume} className="ml-auto" pulse={false} />
        </div>
      </div>
    </div>
  )
}
