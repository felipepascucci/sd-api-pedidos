import { describe, expect, it } from 'vitest'
import { toCurl } from '@/lib/curl'

describe('toCurl', () => {
  it('GET simples aponta para a porta publicada da API', () => {
    expect(toCurl({ origem: 'api', method: 'GET', path: '/pedidos/1' })).toBe("curl -i 'http://localhost:8000/pedidos/1'")
  })

  it('POST inclui método, Content-Type e corpo', () => {
    const body = '{"cliente":"Maria","quantidade":2}'
    expect(toCurl({ origem: 'api', method: 'POST', path: '/pedidos', body })).toBe(
      `curl -i -X POST 'http://localhost:8000/pedidos' -H 'Content-Type: application/json' -d '${body}'`,
    )
  })

  it('escapa aspas simples para o shell', () => {
    const cmd = toCurl({ origem: 'api', method: 'POST', path: '/pedidos', body: `{"cliente":"D'Ávila"}` })
    expect(cmd).toContain(`-d '{"cliente":"D'\\''Ávila"}'`)
  })

  it('DELETE sem corpo usa -X', () => {
    expect(toCurl({ origem: 'api', method: 'DELETE', path: '/pedidos/1', body: null })).toBe("curl -i -X DELETE 'http://localhost:8000/pedidos/1'")
  })

  it('inspetor passa pelo proxy da UI', () => {
    expect(toCurl({ origem: 'inspector', method: 'GET', path: '/db/info' })).toBe("curl -i 'http://localhost:3000/inspector/db/info'")
  })
})
