import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { Skeleton } from '@/components/ui/skeleton'

// Cada página vira um chunk separado, carregado sob demanda.
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const PedidosPage = lazy(() => import('@/pages/PedidosPage').then((m) => ({ default: m.PedidosPage })))
const ConsolePage = lazy(() => import('@/pages/ConsolePage').then((m) => ({ default: m.ConsolePage })))
const BancoPage = lazy(() => import('@/pages/BancoPage').then((m) => ({ default: m.BancoPage })))
const CenariosPage = lazy(() => import('@/pages/CenariosPage').then((m) => ({ default: m.CenariosPage })))
const MaquinaEstadosPage = lazy(() => import('@/pages/MaquinaEstadosPage').then((m) => ({ default: m.MaquinaEstadosPage })))
const InfraestruturaPage = lazy(() => import('@/pages/InfraestruturaPage').then((m) => ({ default: m.InfraestruturaPage })))
const ExperimentoPage = lazy(() => import('@/pages/ExperimentoPage').then((m) => ({ default: m.ExperimentoPage })))
const HistoricoPage = lazy(() => import('@/pages/HistoricoPage').then((m) => ({ default: m.HistoricoPage })))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))

function Carregando() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export default function App() {
  return (
    <div className="flex min-h-svh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
          <Suspense fallback={<Carregando />}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/pedidos" element={<PedidosPage />} />
              <Route path="/console" element={<ConsolePage />} />
              <Route path="/banco" element={<BancoPage />} />
              <Route path="/cenarios" element={<CenariosPage />} />
              <Route path="/maquina-estados" element={<MaquinaEstadosPage />} />
              <Route path="/infraestrutura" element={<InfraestruturaPage />} />
              <Route path="/experimento" element={<ExperimentoPage />} />
              <Route path="/historico" element={<HistoricoPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  )
}
