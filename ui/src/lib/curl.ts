import type { HttpMethod, Origem } from '@/lib/http'

/** Endereços vistos do host: a API publica a 8000; o inspetor só passa pelo proxy da UI. */
export const HOST_BASES: Record<Origem, string> = {
  api: 'http://localhost:8000',
  inspector: 'http://localhost:3000/inspector',
}

function shellQuote(valor: string): string {
  return `'${valor.replace(/'/g, `'\\''`)}'`
}

export interface CurlInput {
  origem: Origem
  method: HttpMethod
  path: string
  body?: string | null
}

export function toCurl({ origem, method, path, body }: CurlInput): string {
  const partes = ['curl -i']
  if (method !== 'GET' || body) partes.push(`-X ${method}`)
  partes.push(shellQuote(`${HOST_BASES[origem]}${path}`))
  if (body !== undefined && body !== null && body !== '') {
    partes.push(`-H ${shellQuote('Content-Type: application/json')}`)
    partes.push(`-d ${shellQuote(body)}`)
  }
  return partes.join(' ')
}
