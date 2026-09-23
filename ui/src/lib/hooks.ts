import { useEffect, useRef, useState } from 'react'

/** Timestamp atual, atualizado a cada `intervalo` ms (para uptime e cronômetros). */
export function useNow(intervalo = 1000): number {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), intervalo)
    return () => clearInterval(id)
  }, [intervalo])
  return agora
}

/**
 * Permite que uma query de polling seja silenciosa por padrão, mas registrada
 * no histórico quando o usuário a dispara explicitamente (botão "Atualizar").
 */
export function useManualFlag() {
  const ref = useRef(false)
  return {
    marcar: () => {
      ref.current = true
    },
    /** Retorna `silent` para a próxima chamada e zera o flag. */
    consumir: () => {
      const manual = ref.current
      ref.current = false
      return !manual
    },
  }
}
