import {
  Database,
  FlaskConical,
  GitBranch,
  History,
  LayoutDashboard,
  Package,
  Server,
  Terminal,
  TestTubeDiagonal,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard },
  { to: '/pedidos', label: 'Pedidos', icon: Package },
  { to: '/console', label: 'Console de API', icon: Terminal },
  { to: '/banco', label: 'Banco de dados', icon: Database },
  { to: '/cenarios', label: 'Cenários', icon: TestTubeDiagonal },
  { to: '/maquina-estados', label: 'Máquina de estados', icon: GitBranch },
  { to: '/infraestrutura', label: 'Infraestrutura', icon: Server },
  { to: '/experimento', label: 'Experimento', icon: FlaskConical },
  { to: '/historico', label: 'Histórico', icon: History },
]
