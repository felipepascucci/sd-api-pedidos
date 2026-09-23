import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type { HttpResult } from '@/lib/http'

export const HISTORY_LIMIT = 500
/** Corpos muito grandes são truncados no histórico para caber no localStorage. */
const MAX_BODY_CHARS = 20_000

interface HistoryState {
  entries: HttpResult[]
  add: (entry: HttpResult) => void
  clear: () => void
}

function truncar(entry: HttpResult): HttpResult {
  if (entry.rawBody.length <= MAX_BODY_CHARS) return entry
  const rawBody = `${entry.rawBody.slice(0, MAX_BODY_CHARS)}\n… (truncado no histórico)`
  return { ...entry, rawBody, body: rawBody, isJson: false }
}

// localStorage pode estar indisponível ou cheio: falhar silenciosamente.
const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* ignora */
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k)
    } catch {
      /* ignora */
    }
  },
}

export const useHistory = create<HistoryState>()(
  persist(
    (set) => ({
      entries: [],
      add: (entry) => set((s) => ({ entries: [truncar(entry), ...s.entries].slice(0, HISTORY_LIMIT) })),
      clear: () => set({ entries: [] }),
    }),
    { name: 'painel-pedidos:historico', storage: createJSONStorage(() => safeStorage) },
  ),
)
