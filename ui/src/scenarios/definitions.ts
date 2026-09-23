/**
 * Cenários de validação da API. Para adicionar um novo, basta incluir um item
 * em CENARIOS com uma função `run` que usa ctx.api / ctx.inspector e as asserções.
 */
import type { Pedido } from '@/lib/pedidos-api'
import { STATUS, transicaoPermitida, type StatusPedido } from '@/lib/status'
import { expectEqual, expectStatus, expectTrue } from '@/scenarios/assertions'
import { PREFIXO_TESTE, type Scenario, type ScenarioContext } from '@/scenarios/runner'

const ID_INEXISTENTE = 999999999
const CAMPOS_PEDIDO: (keyof Pedido)[] = ['id', 'cliente', 'produto', 'quantidade', 'valor_unitario', 'valor_total', 'status', 'data_criacao']

/** POST que deve ser rejeitado com 422 (e não criar nada). */
function rejeita422(id: string, grupo: string, nome: string, descricao: string, corpo: (ctx: ScenarioContext) => unknown): Scenario {
  return {
    id,
    grupo,
    nome,
    descricao,
    esperado: '422 Unprocessable Content',
    run: async (ctx) => {
      const r = await ctx.api.criar(corpo(ctx))
      expectStatus(r, 422)
    },
  }
}

function semCampo(ctx: ScenarioContext, campo: string) {
  const corpo: Record<string, unknown> = ctx.corpoValido()
  delete corpo[campo]
  return corpo
}

const saude: Scenario[] = [
  {
    id: '1',
    grupo: 'Saúde e criação',
    nome: 'GET /health',
    descricao: 'A API informa que está operacional.',
    esperado: '200 e {"status":"ok"}',
    run: async ({ api }) => {
      const r = await api.health()
      expectStatus(r, 200)
      expectEqual(r.body, { status: 'ok' }, 'Corpo do /health')
    },
  },
  {
    id: '2',
    grupo: 'Saúde e criação',
    nome: 'Criar pedido válido',
    descricao: 'POST /pedidos com 2 × 149,90.',
    esperado: '201, status CRIADO, valor_total 299.8, Location /pedidos/{id}, id e data_criacao',
    run: async ({ api, corpoValido }) => {
      const r = await api.criar(corpoValido({ quantidade: 2, valor_unitario: 149.9 }))
      expectStatus(r, 201)
      const p = r.body as Pedido
      expectEqual(p.status, 'CRIADO', 'Status inicial')
      expectEqual(p.valor_total, 299.8, 'valor_total calculado pela API')
      expectTrue(Number.isInteger(p.id), 'id deve ser inteiro', { obtido: p.id })
      expectTrue(!!p.data_criacao && !Number.isNaN(Date.parse(p.data_criacao)), 'data_criacao deve ser uma data válida', { obtido: p.data_criacao })
      expectEqual(r.responseHeaders.location, `/pedidos/${p.id}`, 'Header Location')
    },
  },
  ...(
    [
      ['3.1', 3, 0.35, 1.05],
      ['3.2', 7, 1.15, 8.05],
    ] as const
  ).map(
    ([id, q, v, total]): Scenario => ({
      id,
      grupo: 'Saúde e criação',
      nome: `Precisão decimal: ${q} × ${v}`,
      descricao: `Em float binário, ${q} * ${v} = ${q * v}. A API usa Decimal.`,
      esperado: `201 e valor_total ${total}`,
      run: async ({ api, corpoValido }) => {
        const r = await api.criar(corpoValido({ quantidade: q, valor_unitario: v }))
        expectStatus(r, 201)
        expectEqual((r.body as Pedido).valor_total, total, 'valor_total')
      },
    }),
  ),
]

const G_VALIDACAO = 'Validação (422)'
const textoLongo = (ctx: ScenarioContext) => `${ctx.cliente} `.padEnd(256, 'x')

const validacao: Scenario[] = [
  ...(['cliente', 'produto', 'quantidade', 'valor_unitario'] as const).map((campo, i) =>
    rejeita422(`4.${i + 1}`, G_VALIDACAO, `Sem o campo ${campo}`, 'Campo obrigatório ausente.', (ctx) => semCampo(ctx, campo)),
  ),
  ...(
    [
      ['5.1', 'quantidade = 0', 0],
      ['5.2', 'quantidade negativa', -1],
      ['5.3', 'quantidade decimal (2.5)', 2.5],
      ['5.4', 'quantidade string ("2")', '2'],
    ] as const
  ).map(([id, nome, quantidade]) => rejeita422(id, G_VALIDACAO, nome, 'quantidade deve ser inteiro estrito > 0.', (ctx) => ctx.corpoValido({ quantidade }))),
  ...(
    [
      ['6.1', 'valor_unitario = 0', 0],
      ['6.2', 'valor_unitario negativo', -5],
      ['6.3', 'valor_unitario com 3 casas (10.999)', 10.999],
    ] as const
  ).map(([id, nome, valor_unitario]) =>
    rejeita422(id, G_VALIDACAO, nome, 'valor_unitario deve ser > 0 com no máximo 2 casas.', (ctx) => ctx.corpoValido({ valor_unitario })),
  ),
  rejeita422('7.1', G_VALIDACAO, 'cliente vazio', 'String vazia não é aceita.', (ctx) => ctx.corpoValido({ cliente: '' })),
  rejeita422('7.2', G_VALIDACAO, 'cliente só com espaços', 'Após remover os espaços, fica vazio.', (ctx) => ctx.corpoValido({ cliente: '   ' })),
  rejeita422('7.3', G_VALIDACAO, 'produto vazio', 'String vazia não é aceita.', (ctx) => ctx.corpoValido({ produto: '' })),
  rejeita422('8', G_VALIDACAO, 'cliente com 256 caracteres', 'Máximo de 255 caracteres.', (ctx) => ctx.corpoValido({ cliente: textoLongo(ctx) })),
  ...(
    [
      ['9.1', 'status', 'CONFIRMADO'],
      ['9.2', 'valor_total', 1],
      ['9.3', 'id', 42],
    ] as const
  ).map(([id, campo, valor]) =>
    rejeita422(id, G_VALIDACAO, `Campo extra: ${campo}`, 'O cliente não pode definir campos calculados pela aplicação.', (ctx) => ctx.corpoValido({ [campo]: valor })),
  ),
  {
    id: '10',
    grupo: G_VALIDACAO,
    nome: 'Corpo que não é JSON válido',
    descricao: 'Texto cru com Content-Type application/json.',
    esperado: '422 Unprocessable Content',
    run: async ({ api, cliente }) => {
      const r = await api.criarRaw(`{"cliente": "${cliente}", "produto": `)
      expectStatus(r, 422)
    },
  },
]

const G_CONSULTA = 'Consulta e listagem'
const consulta: Scenario[] = [
  {
    id: '11',
    grupo: G_CONSULTA,
    nome: 'GET /pedidos/{id} do pedido criado',
    descricao: 'A consulta devolve exatamente o que a criação devolveu.',
    esperado: '200 e dados idênticos',
    run: async ({ api, criarPedido }) => {
      const criado = await criarPedido()
      const r = await api.consultar(criado.id)
      expectStatus(r, 200)
      expectEqual(r.body, criado, 'Dados da consulta x dados da criação')
    },
  },
  {
    id: '12',
    grupo: G_CONSULTA,
    nome: 'GET de id inexistente',
    descricao: `GET /pedidos/${ID_INEXISTENTE}.`,
    esperado: '404 com detail',
    run: async ({ api }) => {
      const r = await api.consultar(ID_INEXISTENTE)
      expectStatus(r, 404)
      const detail = (r.body as { detail?: unknown } | null)?.detail
      expectTrue(typeof detail === 'string' && detail.length > 0, 'Resposta deve ter "detail" com mensagem', { obtido: r.body })
    },
  },
  {
    id: '13',
    grupo: G_CONSULTA,
    nome: 'GET /pedidos/abc',
    descricao: 'id no caminho precisa ser inteiro.',
    esperado: '422 Unprocessable Content',
    run: async ({ api }) => {
      expectStatus(await api.consultar('abc'), 422)
    },
  },
  {
    id: '14',
    grupo: G_CONSULTA,
    nome: 'GET /pedidos',
    descricao: 'Lista contém o pedido criado e está ordenada por id.',
    esperado: '200, lista ordenada contendo o novo pedido',
    run: async ({ api, criarPedido }) => {
      const criado = await criarPedido()
      const r = await api.listar()
      expectStatus(r, 200)
      expectTrue(Array.isArray(r.body), 'Corpo deve ser uma lista', { obtido: typeof r.body })
      const ids = (r.body as Pedido[]).map((p) => p.id)
      expectTrue(ids.includes(criado.id), `A lista deve conter o pedido ${criado.id}`)
      const ordenados = [...ids].sort((a, b) => a - b)
      expectEqual(ids, ordenados, 'Lista ordenada por id crescente')
    },
  },
]

const G_ESTADOS = 'Máquina de estados'
const transicoesValidas = STATUS.flatMap((de) => STATUS.filter((para) => transicaoPermitida(de, para)).map((para) => [de, para] as const))
const transicoesInvalidas: (readonly [StatusPedido, StatusPedido])[] = [
  ['CANCELADO', 'CONFIRMADO'],
  ['CANCELADO', 'CRIADO'],
  ['CONFIRMADO', 'CRIADO'],
  ['CRIADO', 'CRIADO'],
  ['CONFIRMADO', 'CONFIRMADO'],
  ['CANCELADO', 'CANCELADO'],
]

const estados: Scenario[] = [
  ...transicoesValidas.map(
    ([de, para], i): Scenario => ({
      id: `15.${i + 1}`,
      grupo: G_ESTADOS,
      nome: `${de} → ${para}`,
      descricao: 'Transição permitida; o novo status aparece num GET posterior.',
      esperado: '200 e status atualizado',
      run: async ({ api, pedidoNoStatus }) => {
        const p = await pedidoNoStatus(de)
        const r = await api.alterarStatus(p.id, { status: para })
        expectStatus(r, 200)
        expectEqual((r.body as Pedido).status, para, 'Status na resposta do PATCH')
        const g = await api.consultar(p.id)
        expectStatus(g, 200)
        expectEqual((g.body as Pedido).status, para, 'Status num GET posterior')
      },
    }),
  ),
  ...transicoesInvalidas.map(
    ([de, para], i): Scenario => ({
      id: `16.${i + 1}`,
      grupo: G_ESTADOS,
      nome: `${de} → ${para}`,
      descricao: 'Transição proibida.',
      esperado: '409 Conflict',
      run: async ({ api, pedidoNoStatus }) => {
        const p = await pedidoNoStatus(de)
        expectStatus(await api.alterarStatus(p.id, { status: para }), 409)
      },
    }),
  ),
  {
    id: '17',
    grupo: G_ESTADOS,
    nome: 'Status não muda após 409',
    descricao: 'Pedido CONFIRMADO; tentar CRIADO (409); o GET continua mostrando CONFIRMADO.',
    esperado: '409 e status inalterado',
    run: async ({ api, pedidoNoStatus }) => {
      const p = await pedidoNoStatus('CONFIRMADO')
      expectStatus(await api.alterarStatus(p.id, { status: 'CRIADO' }), 409)
      const g = await api.consultar(p.id)
      expectStatus(g, 200)
      expectEqual((g.body as Pedido).status, 'CONFIRMADO', 'Status após o 409')
    },
  },
  {
    id: '18.1',
    grupo: G_ESTADOS,
    nome: 'PATCH com status inexistente',
    descricao: '{"status": "ENVIADO"} não faz parte do enum.',
    esperado: '422 Unprocessable Content',
    run: async ({ api, criarPedido }) => {
      const p = await criarPedido()
      expectStatus(await api.alterarStatus(p.id, { status: 'ENVIADO' }), 422)
    },
  },
  {
    id: '18.2',
    grupo: G_ESTADOS,
    nome: 'PATCH em id inexistente',
    descricao: `PATCH /pedidos/${ID_INEXISTENTE}/status.`,
    esperado: '404 Not Found',
    run: async ({ api }) => {
      expectStatus(await api.alterarStatus(ID_INEXISTENTE, { status: 'CONFIRMADO' }), 404)
    },
  },
  {
    id: '19',
    grupo: G_ESTADOS,
    nome: 'PATCH altera apenas o status',
    descricao: 'Todos os outros campos continuam idênticos.',
    esperado: '200 e demais campos inalterados',
    run: async ({ api, criarPedido }) => {
      const antes = await criarPedido()
      const r = await api.alterarStatus(antes.id, { status: 'CONFIRMADO' })
      expectStatus(r, 200)
      const depois = r.body as Pedido
      for (const campo of CAMPOS_PEDIDO.filter((c) => c !== 'status')) {
        expectEqual(depois[campo], antes[campo], `Campo ${campo} não deveria mudar`)
      }
    },
  },
]

const G_BANCO = 'Consistência com o banco (inspetor)'
const banco: Scenario[] = [
  {
    id: '20',
    grupo: G_BANCO,
    nome: 'Pedido criado existe na tabela',
    descricao: 'Cria pela API e procura a linha no PostgreSQL pelo inspetor.',
    esperado: 'Linha com os mesmos valores',
    run: async ({ inspector, criarPedido }) => {
      const p = await criarPedido()
      const r = await inspector.linhas('pedidos', { order_by: 'id', direction: 'desc', limit: 50 })
      expectStatus(r, 200)
      const linha = r.body?.rows.find((row) => row.id === p.id)
      expectTrue(!!linha, `Linha com id ${p.id} deveria existir na tabela pedidos`)
      for (const campo of ['cliente', 'produto', 'quantidade', 'valor_unitario', 'valor_total', 'status'] as const) {
        expectEqual(linha[campo], p[campo], `Coluna ${campo} no banco x API`)
      }
      expectEqual(Date.parse(String(linha.data_criacao)), Date.parse(p.data_criacao), 'data_criacao (mesmo instante)')
    },
  },
  {
    id: '21',
    grupo: G_BANCO,
    nome: 'Constraints CHECK no schema',
    descricao: 'quantidade > 0 e valor_unitario > 0 também são garantidos pelo banco.',
    esperado: 'Duas constraints CHECK',
    run: async ({ inspector }) => {
      const r = await inspector.schema('pedidos')
      expectStatus(r, 200)
      const checks = (r.body?.constraints ?? []).filter((c) => c.tipo === 'CHECK').map((c) => c.definicao)
      expectTrue(checks.some((d) => /quantidade\s*>\s*0/.test(d)), 'CHECK de quantidade > 0', { obtido: checks })
      expectTrue(checks.some((d) => /valor_unitario\s*>\s*\(?0/.test(d)), 'CHECK de valor_unitario > 0', { obtido: checks })
    },
  },
  {
    id: '22',
    grupo: G_BANCO,
    nome: 'Contagem API = contagem do banco',
    descricao: 'Tamanho de GET /pedidos igual ao count(*) da tabela.',
    esperado: 'Mesmo número',
    run: async ({ api, inspector }) => {
      const l = await api.listar()
      expectStatus(l, 200)
      const t = await inspector.tabelas()
      expectStatus(t, 200)
      const tabela = t.body?.find((x) => x.nome === 'pedidos')
      expectTrue(!!tabela, 'Tabela pedidos deveria existir')
      expectEqual((l.body as Pedido[]).length, tabela.linhas, 'GET /pedidos x count(*)')
    },
  },
]

export const CENARIOS: Scenario[] = [...saude, ...validacao, ...consulta, ...estados, ...banco]
export { PREFIXO_TESTE }
