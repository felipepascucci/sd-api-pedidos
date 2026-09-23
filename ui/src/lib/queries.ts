/** Queries de polling (silenciosas: não entram no histórico nem geram toast). */
import { useQuery } from '@tanstack/react-query'
import { pedidosApi } from '@/lib/pedidos-api'
import { inspectorApi, type ContainerInfo } from '@/lib/inspector-api'

export const POLL_MS = 5000

export type Saude = 'ok' | 'degradado' | 'fora' | 'carregando'

export function useApiHealth() {
  return useQuery({
    queryKey: ['api-health'],
    queryFn: () => pedidosApi.health({ silent: true }),
    refetchInterval: POLL_MS,
  })
}

export function useDbInfo() {
  return useQuery({
    queryKey: ['db-info'],
    queryFn: () => inspectorApi.dbInfo({ silent: true }),
    refetchInterval: POLL_MS,
  })
}

export function useContainers(intervalo: number = POLL_MS) {
  return useQuery({
    queryKey: ['containers'],
    queryFn: () => inspectorApi.containers({ silent: true }),
    refetchInterval: intervalo,
  })
}

export function usePedidos() {
  return useQuery({
    queryKey: ['pedidos'],
    queryFn: () => pedidosApi.listar({ silent: true }),
    refetchInterval: POLL_MS,
  })
}

export function saudeContainer(c: ContainerInfo | undefined): Saude {
  if (!c) return 'fora'
  if (c.estado === 'restarting' || c.health === 'starting') return 'degradado'
  if (c.estado !== 'running' || c.health === 'unhealthy') return 'fora'
  return 'ok'
}

/** Consolida a saúde de API, banco e Docker para a topbar e o dashboard. */
export function useSaude() {
  const api = useApiHealth()
  const db = useDbInfo()
  const containers = useContainers()

  const lista = containers.data?.ok ? (containers.data.body ?? []) : []
  const porServico = (s: string) => lista.find((c) => c.servico === s)

  let saudeApi: Saude = 'carregando'
  if (api.data) {
    const reiniciando = saudeContainer(porServico('pedidos')) === 'degradado'
    saudeApi = api.data.status === 200 ? 'ok' : reiniciando ? 'degradado' : 'fora'
  }

  let saudeDb: Saude = 'carregando'
  if (db.data) saudeDb = db.data.status === 200 ? 'ok' : 'fora'

  let saudeDocker: Saude = 'carregando'
  if (containers.data) {
    if (!containers.data.ok) saudeDocker = 'fora'
    else saudeDocker = lista.every((c) => saudeContainer(c) === 'ok') ? 'ok' : 'degradado'
  }

  return {
    api,
    db,
    containers,
    lista,
    porServico,
    saude: { api: saudeApi, db: saudeDb, docker: saudeDocker },
  }
}

export const SAUDE_STYLE: Record<Saude, { dot: string; text: string; ring: string; label: string }> = {
  ok: { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500/40', label: 'Operacional' },
  degradado: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-500/40', label: 'Reiniciando' },
  fora: { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', ring: 'ring-red-500/40', label: 'Fora do ar' },
  carregando: { dot: 'bg-muted-foreground/50', text: 'text-muted-foreground', ring: 'ring-border', label: 'Verificando…' },
}
