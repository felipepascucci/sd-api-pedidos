import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Menu } from 'lucide-react'
import { cn } from 'cn'
import { HealthDot } from '@/components/common'
import { NAV } from '@/components/layout/nav'
import { SidebarContent } from '@/components/layout/Sidebar'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDuration } from '@/lib/format'
import { SAUDE_STYLE, useSaude, type Saude } from '@/lib/queries'

function Indicador({ label, saude, detalhe, to }: { label: string; saude: Saude; detalhe: string; to: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={to}
          className={cn(
            'inline-flex h-7 items-center gap-2 rounded-full border px-2.5 text-xs transition-colors hover:bg-muted',
            saude === 'fora' && 'border-red-500/40',
            saude === 'degradado' && 'border-amber-500/40',
          )}
        >
          <HealthDot saude={saude} />
          <span className="font-medium">{label}</span>
          <span className={cn('hidden lg:inline', SAUDE_STYLE[saude].text)}>{SAUDE_STYLE[saude].label}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent>{detalhe}</TooltipContent>
    </Tooltip>
  )
}

export function Topbar() {
  const [aberto, setAberto] = useState(false)
  const { pathname } = useLocation()
  const { saude, api, db, containers } = useSaude()
  const pagina = NAV.find((n) => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)))

  const detalheApi = api.data
    ? api.data.status === 200
      ? `GET /health → 200 em ${formatDuration(api.data.durationMs)}`
      : (api.data.error ?? `GET /health → ${api.data.status}`)
    : 'Verificando…'
  const detalheDb = db.data
    ? db.data.ok
      ? `PostgreSQL ${db.data.body?.versao} · ${db.data.body?.banco}`
      : 'Inspetor não conseguiu ler o banco'
    : 'Verificando…'
  const detalheDocker = containers.data
    ? containers.data.ok
      ? `${containers.data.body?.length ?? 0} containers no projeto`
      : 'Inspetor sem acesso ao Docker'
    : 'Verificando…'

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
      <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setAberto(true)} aria-label="Abrir menu">
        <Menu />
      </Button>
      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent side="left" className="w-64 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navegação</SheetTitle>
          <SheetDescription className="sr-only">Páginas do painel</SheetDescription>
          <SidebarContent onNavigate={() => setAberto(false)} />
        </SheetContent>
      </Sheet>

      <p className="truncate text-sm font-medium">{pagina?.label}</p>

      <div className="ml-auto flex items-center gap-1.5">
        <Indicador label="API" saude={saude.api} detalhe={detalheApi} to="/" />
        <Indicador label="Banco" saude={saude.db} detalhe={detalheDb} to="/banco" />
        <Indicador label="Docker" saude={saude.docker} detalhe={detalheDocker} to="/infraestrutura" />
        <ThemeToggle />
      </div>
    </header>
  )
}
