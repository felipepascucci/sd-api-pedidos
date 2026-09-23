import { NavLink } from 'react-router'
import { Boxes } from 'lucide-react'
import { cn } from 'cn'
import { NAV } from '@/components/layout/nav'
import { useHistory } from '@/stores/history'

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const total = useHistory((s) => s.entries.length)
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 border-b px-4">
        <div className="flex size-7 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Boxes className="size-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">API de Pedidos</p>
          <p className="text-[11px] text-muted-foreground">Painel de testes</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                isActive
                  ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
              )
            }
          >
            <Icon className="size-4" />
            <span className="flex-1">{label}</span>
            {to === '/historico' && total > 0 && (
              <span className="rounded bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">{total}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t p-3 text-[11px] leading-relaxed text-muted-foreground">
        Sistemas Distribuídos · UNIP
        <br />
        Ferramenta opcional do grupo
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-svh w-60 shrink-0 border-r bg-sidebar md:block">
      <SidebarContent />
    </aside>
  )
}
