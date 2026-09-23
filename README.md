# API de Pedidos

Trabalho 1 da disciplina **Desenvolvimento de Sistemas Distribuídos** (UNIP).

Primeira versão de uma API REST de pedidos, que será evoluída ao longo da disciplina (serviços de Estoque, Pagamento, replicação, balanceamento etc.). O domínio é pequeno de propósito: o foco está na arquitetura (camadas bem separadas, aplicação stateless, configuração por ambiente e execução reprodutível com Docker).

## Integrantes do grupo

| Nome | RA |
|------|----|
| Felipe Rafael Tancredi Pascucci | T895HG3 |
| Giovanna Santos da Silva | G828HA5 |
| Isabelle Rosa Moura Ferreira | N075465 |
| Kauã da Silva Ferreira | G788486 |
| Leonardo Annunciação Rodrigues | G801873 |
| Luan Gabriel Melo da Rocha | G7787G0 |

## Arquitetura

```mermaid
flowchart LR
    C[Cliente] -- "HTTP/JSON :8000" --> P["Container pedidos<br/>(FastAPI + Uvicorn)"]
    P -- "protocolo PostgreSQL :5432<br/>(rede interna backend)" --> DB[("Container postgres<br/>(PostgreSQL 16)")]
    DB --- V[/"Volume postgres_data"/]
```

- **Dois containers, dois processos:** a aplicação (`pedidos`) e o banco (`postgres`) executam separadamente. O cliente acessa apenas a porta 8000 publicada pela API; o PostgreSQL **não** publica porta para o host e só é alcançável pela rede interna `backend`.
- **Três camadas lógicas dentro do mesmo container:** camada não é container. API, Service e Repository são divisões do código, empacotadas juntas no processo `pedidos`:

  | Camada | Onde | Responsabilidade |
  |---|---|---|
  | API (controller) | `app/api/` | Interface HTTP: valida a estrutura da requisição (schemas Pydantic), chama o Service e traduz resultados/exceções em respostas HTTP. Não faz queries nem contém regra de negócio. |
  | Service | `app/services/` | Regras de negócio: cálculo do `valor_total`, status inicial, máquina de estados. Não conhece HTTP nem monta queries. |
  | Repository | `app/repositories/` | Acesso ao banco via SQLAlchemy (persistir, buscar, listar, atualizar). Não contém regra de negócio. |

  Fluxo de um `POST /pedidos`: API valida o corpo → Service calcula o total e define o status `CRIADO` → Repository persiste → banco confirma (commit) → API responde `201 Created`.

- **Aplicação stateless:** nenhum dado fica em memória entre requisições; tudo vive no PostgreSQL. Por isso a mesma imagem poderá, no futuro, originar várias instâncias equivalentes atrás de um balanceador (a unidade de replicação é a aplicação de Pedidos inteira).
- **Volume nomeado:** os arquivos do banco ficam no volume `postgres_data`, que existe independentemente do ciclo de vida dos containers.

## Estrutura do repositório

```
.
├── app/
│   ├── main.py                    # FastAPI, lifespan (espera o banco + create_all), routers, handlers de erro
│   ├── config.py                  # leitura das variáveis de ambiente
│   ├── database.py                # engine, SessionLocal, Base, get_db, wait_for_db
│   ├── api/
│   │   ├── pedidos.py             # endpoints /pedidos
│   │   └── health.py              # endpoint /health
│   ├── services/
│   │   ├── pedido_service.py      # regras de negócio e máquina de estados
│   │   └── exceptions.py          # exceções de domínio
│   ├── repositories/
│   │   └── pedido_repository.py   # acesso ao banco
│   ├── models/
│   │   └── pedido.py              # modelo SQLAlchemy Pedido + enum StatusPedido
│   └── schemas/
│       └── pedido.py              # schemas Pydantic de entrada e saída
├── tests/
│   ├── conftest.py                # cria o banco pedidos_test, fixtures de cliente e limpeza
│   ├── unit/                      # testes do Service com repositório falso (sem banco)
│   └── integration/               # testes HTTP com PostgreSQL real
├── docs/
│   ├── plano_desenvolvimento.md   # plano/requisitos do trabalho
│   └── plano_ui.md                # plano do painel de testes (opcional)
├── inspector/                     # painel: serviço somente leitura do banco + controle restrito do Docker
├── ui/                            # painel: React + nginx (proxy para a API e o inspetor)
├── Dockerfile                     # imagem da aplicação
├── docker-compose.yml             # pedidos, postgres, tests (profile test), ui e inspector (profile ui)
├── requirements.txt               # dependências de execução
├── requirements-dev.txt           # dependências de teste
├── pytest.ini
├── .env.example                   # referência opcional de variáveis
├── .gitignore / .dockerignore / .gitattributes
└── README.md
```

## Pré-requisitos

Apenas **Git** e **Docker** (com Docker Compose v2). Nada precisa ser instalado no host além disso.

## Como executar

```bash
git clone https://github.com/felipepascucci/sd-api-pedidos.git
cd sd-api-pedidos
git checkout APIPedidos-1-final
docker compose up -d --build
```

Esse último comando constrói a imagem, sobe o PostgreSQL, aguarda ele ficar saudável e inicia a API, que cria a tabela automaticamente. Não há passo manual.

- API: http://localhost:8000
- Documentação interativa (Swagger): http://localhost:8000/docs

## Configuração

A aplicação não tem endereço, porta, usuário ou senha do banco fixos no código: recebe tudo por variáveis de ambiente.

| Variável | Onde é usada | Padrão |
|---|---|---|
| `POSTGRES_DB` | compose (banco e URL da API) | `pedidos` |
| `POSTGRES_USER` | compose (banco e URL da API) | `pedidos` |
| `POSTGRES_PASSWORD` | compose (banco e URL da API) | `pedidos` |
| `DATABASE_URL` | aplicação (obrigatória) | montada pelo compose: `postgresql+psycopg://pedidos:pedidos@postgres:5432/pedidos` |
| `DB_CONNECT_RETRIES` | aplicação (opcional) | `30` tentativas de conexão no startup |
| `DB_CONNECT_INTERVAL` | aplicação (opcional) | `2` segundos entre tentativas |

O `docker-compose.yml` usa interpolação com valor padrão (`${POSTGRES_USER:-pedidos}`), então **nenhum arquivo `.env` é necessário**. Para personalizar, copie `.env.example` para `.env` e altere os valores (o `.env` não é versionado). Se `DATABASE_URL` não estiver definida, a aplicação falha no startup com uma mensagem clara.

## Endpoints

| Método | Rota | Descrição | Códigos |
|---|---|---|---|
| `POST` | `/pedidos` | Cria um pedido | 201, 422 |
| `GET` | `/pedidos/{id}` | Consulta um pedido | 200, 404, 422 |
| `GET` | `/pedidos` | Lista todos os pedidos (ordem de `id`) | 200 |
| `PATCH` | `/pedidos/{id}/status` | Altera o status de um pedido | 200, 404, 409, 422 |
| `GET` | `/health` | Verifica se a aplicação está operacional | 200 |

Erros seguem o formato padrão do FastAPI: `{"detail": "<mensagem>"}` (no 422, `detail` é a lista de erros de validação).

### Criar pedido

```bash
curl -i -X POST http://localhost:8000/pedidos \
  -H "Content-Type: application/json" \
  -d '{"cliente":"Maria Silva","produto":"Teclado","quantidade":2,"valor_unitario":149.90}'
```

```
HTTP/1.1 201 Created
location: /pedidos/1

{"id":1,"cliente":"Maria Silva","produto":"Teclado","quantidade":2,"valor_unitario":149.9,"valor_total":299.8,"status":"CRIADO","data_criacao":"2026-09-23T15:34:30.106011Z"}
```

O cliente não pode enviar `id`, `valor_total`, `status` ou `data_criacao`: campos extras resultam em `422`. Também dão `422`: campo obrigatório ausente, `quantidade` não inteira, ≤ 0 ou acima de 1.000.000, `valor_unitario` ≤ 0, acima de 999.999,99 ou com mais de 2 casas decimais, `cliente`/`produto` vazios ou só com espaços. Os limites máximos garantem que nenhum valor estoure as colunas do banco (o maior `valor_total` possível cabe em `NUMERIC(14,2)`).

### Consultar pedido

```bash
curl -s http://localhost:8000/pedidos/1
```

```json
{"id":1,"cliente":"Maria Silva","produto":"Teclado","quantidade":2,"valor_unitario":149.9,"valor_total":299.8,"status":"CRIADO","data_criacao":"2026-09-23T15:34:30.106011Z"}
```

```bash
curl -s http://localhost:8000/pedidos/99
```

```json
{"detail":"Pedido 99 não encontrado"}
```

### Listar pedidos

```bash
curl -s http://localhost:8000/pedidos
```

```json
[{"id":1,"cliente":"Maria Silva","produto":"Teclado","quantidade":2,"valor_unitario":149.9,"valor_total":299.8,"status":"CRIADO","data_criacao":"2026-09-23T15:34:30.106011Z"}]
```

### Alterar status

```bash
curl -s -X PATCH http://localhost:8000/pedidos/1/status \
  -H "Content-Type: application/json" -d '{"status":"CONFIRMADO"}'
```

```json
{"id":1,"cliente":"Maria Silva","produto":"Teclado","quantidade":2,"valor_unitario":149.9,"valor_total":299.8,"status":"CONFIRMADO","data_criacao":"2026-09-23T15:34:30.106011Z"}
```

Transição não permitida (ex.: voltar para `CRIADO`):

```bash
curl -s -X PATCH http://localhost:8000/pedidos/1/status \
  -H "Content-Type: application/json" -d '{"status":"CRIADO"}'
```

```
HTTP 409
{"detail":"Transição de status inválida: CONFIRMADO -> CRIADO"}
```

### Saúde

```bash
curl -s http://localhost:8000/health
```

```json
{"status":"ok"}
```

O `/health` não acessa o banco nesta versão; é uma verificação leve que servirá futuramente para disponibilidade, balanceamento e monitoramento.

## Modelo de pedido e máquina de estados

| Campo | Tipo | Observação |
|---|---|---|
| `id` | inteiro | gerado pelo banco; nas rotas, aceito de 1 a 2.147.483.647 (limite do `INTEGER`), fora disso `422` |
| `cliente` | texto (até 255) | obrigatório |
| `produto` | texto (até 255) | obrigatório |
| `quantidade` | inteiro | de 1 a 1.000.000 |
| `valor_unitario` | decimal (12,2) | maior que 0 e até 999.999,99 (no máximo 2 casas) |
| `valor_total` | decimal (14,2) | calculado pela aplicação: `quantidade × valor_unitario`, arredondado para 2 casas (ROUND_HALF_UP). Com os limites acima, o máximo é 999.999.990.000,00, que cabe na coluna |
| `status` | `CRIADO` / `CONFIRMADO` / `CANCELADO` | inicial sempre `CRIADO` |
| `data_criacao` | data/hora com fuso | definida pelo banco |

Transições permitidas:

| De | Para |
|---|---|
| `CRIADO` | `CONFIRMADO` |
| `CRIADO` | `CANCELADO` |
| `CONFIRMADO` | `CANCELADO` |

Qualquer outra transição é rejeitada com `409 Conflict`: `CANCELADO` é estado final, nenhum pedido volta para `CRIADO` e não é permitido "transicionar" para o mesmo status. As transições ficam num dicionário (`TRANSICOES_PERMITIDAS` em `app/services/pedido_service.py`), e o status é gravado como texto no banco, então novos estados (que virão com os serviços de Estoque e Pagamento) podem ser adicionados sem reescrita.

## Testes

Os testes rodam dentro do Docker, sem instalar nada no host:

```bash
docker compose up -d --build                  # garante que o postgres está no ar
docker compose --profile test run --rm --build tests
```

O `--build` garante que a imagem de testes seja reconstruída com o código atual: sem ele, o `docker compose run` reaproveita uma imagem `tests` que já exista e pode testar uma versão antiga. O serviço `tests` pertence ao profile `test`, então não sobe com `docker compose up`. Ele usa o banco separado `pedidos_test` (criado automaticamente pelo `conftest.py`), nunca o banco principal.

- **Unitários** (`tests/unit/`): testam o `PedidoService` com um repositório falso em memória, sem banco. Cobrem cálculo e arredondamento do `valor_total` (ex.: `3 × 0.335 = 1.01`), status inicial `CRIADO`, pedido inexistente, todas as transições permitidas, as transições inválidas e que alterar o status não modifica os demais campos.
- **Integração** (`tests/integration/`): testam a API via `TestClient` com PostgreSQL real. Cobrem `/health`, criação (201, `Location`, total, status, valores nos limites máximos), validações (422, inclusive valores que estourariam as colunas do banco), consulta (200/404/422, inclusive ids fora do intervalo do `INTEGER`), listagem (vazia e ordenada), alteração de status (200/404/409/422) e persistência (o pedido é lido por uma nova sessão e por um novo cliente).

O aviso `StarletteDeprecationWarning` sobre `httpx` que aparece na saída do pytest vem da própria biblioteca de testes e não afeta o resultado.

## Experimento: o dado está onde?

Com o ambiente no ar:

```bash
# 1. cria um pedido
curl -s -X POST http://localhost:8000/pedidos -H "Content-Type: application/json" \
  -d '{"cliente":"Maria","produto":"Teclado","quantidade":2,"valor_unitario":149.90}'

# 2. consulta o pedido
curl -s http://localhost:8000/pedidos/1

# 3. reinicia SOMENTE o container da aplicação
docker compose restart pedidos

# 4. consulta de novo: o pedido continua lá
curl -s http://localhost:8000/pedidos/1
```

**Por que o dado permaneceu?** O pedido não fica na memória da aplicação, e sim no PostgreSQL, que é outro processo, em outro container. Os arquivos do banco estão no volume Docker nomeado `postgres_data`, que existe independentemente do ciclo de vida dos containers. Reiniciar o container `pedidos` não afeta nem o container `postgres` nem o volume; como a API é stateless, ela apenas reconecta ao banco e lê os dados.

Por outro lado, `docker compose down -v` remove o volume e, aí sim, apaga os dados.

## Parar e limpar

```bash
docker compose down      # para e remove os containers; os dados continuam no volume
docker compose down -v   # remove também o volume: apaga todos os pedidos
```

## Decisões técnicas

- **Python 3.12 + FastAPI + Uvicorn**, com validação por **Pydantic v2** e documentação automática em `/docs`.
- **SQLAlchemy 2.0 síncrono** com driver **psycopg 3**: simples e suficiente para o volume deste trabalho.
- **`Base.metadata.create_all()` no startup**, sem Alembic: a tabela é criada automaticamente se não existir (idempotente). Migrações ficam para versões futuras.
- **Espera ativa pelo banco** (`wait_for_db`, `SELECT 1` com novas tentativas) além do `healthcheck` + `depends_on: service_healthy` do compose; se esgotar as tentativas, o container reinicia (`restart: unless-stopped`).
- **`Decimal` para dinheiro** em toda a cadeia interna; no JSON os valores saem como número (ex.: `149.9`).
- **Status como texto** (`native_enum=False`), sem tipo ENUM do PostgreSQL, para facilitar a inclusão de novos estados.
- **409 Conflict** para transição de status inválida (o pedido existe, mas seu estado atual impede a operação); 404 para pedido inexistente; 422 para corpo inválido.
- **Limites máximos na validação** (`quantidade` ≤ 1.000.000, `valor_unitario` ≤ 999.999,99, `id` ≤ 2.147.483.647): valores extremos recebem 422 na borda da API, em vez de estourar as colunas do banco e virar erro 500.
- **Campos extras proibidos** (`extra="forbid"`) na entrada: `id`, `valor_total`, `status` e `data_criacao` são sempre definidos pela aplicação/banco.
- **Porta do banco não exposta ao host**: só a API é pública; o banco fica na rede interna `backend`.
- **Sem `container_name`** no compose, para permitir múltiplas instâncias no futuro.
- **Container da aplicação roda como usuário não-root** (`appuser`).
- **Banco de testes separado** (`pedidos_test`), criado pelos próprios testes.

## Painel de testes (opcional)

> **Ferramenta extra do grupo, fora do escopo exigido pelo trabalho.** Ela não sobe com o `docker compose up -d --build` padrão: os serviços `ui` e `inspector` ficam no profile `ui` do compose. A API de Pedidos não foi alterada para atender o painel.

Painel web (React) para testar, visualizar e demonstrar a API: estado dos containers, chamadas com requisição e resposta completas, conteúdo real do banco e o experimento de persistência guiado.

### Como executar

```bash
docker compose --profile ui up -d --build     # API + banco + painel + inspetor
# abrir http://localhost:3000
docker compose --profile ui down              # derruba tudo (mantém os dados)
```

### Páginas

| Página | O que faz |
|---|---|
| Visão geral | Saúde de API, banco e containers (atualiza a cada 5 s), diagrama de arquitetura ao vivo, métricas dos pedidos e últimas requisições. |
| Pedidos | Tabela com busca, filtro e ordenação; criação de pedido (erros 422 aparecem em cada campo); detalhes e botões para todas as mudanças de status, inclusive as proibidas (para ver o 409). |
| Console de API | "Postman" embutido: presets para cada endpoint, método e caminho livres, corpo JSON (pode ser inválido), resposta completa e "Copiar como curl". |
| Banco de dados | Informações do PostgreSQL, tabelas, schema (colunas, constraints CHECK, índices) e as linhas reais, com auto-refresh e destaque do que mudou. |
| Cenários | 50 testes automatizados (saúde, criação, validações, consulta, máquina de estados, limites de valores e consistência API × banco) com passou/falhou e esperado × obtido. |
| Máquina de estados | Diagrama interativo: clique num estado para enviar o PATCH real e ver a transição aceita ou o 409. |
| Infraestrutura | Estado, uptime, imagem e portas de cada container; restart de `pedidos` e `postgres`; logs ao vivo. |
| Experimento | Assistente do experimento "o dado está onde?": cria um pedido, reinicia o container, mede o tempo fora do ar e compara os dados antes e depois. |
| Histórico | Todas as requisições feitas pelo painel, com filtros, detalhes, "Reenviar" e "Copiar como curl". |

### Arquitetura do painel

```
Navegador ──> ui (nginx, localhost:3000)
                ├── /            → arquivos estáticos do React
                ├── /api/*       → http://pedidos:8000/*    (API de Pedidos, sem alteração)
                └── /inspector/* → http://inspector:8001/*  (não publicado no host)

inspector ──> postgres:5432          (conexão somente leitura)
inspector ──> /var/run/docker.sock   (status, logs e restart de pedidos/postgres)
```

- **Proxy nginx:** o navegador só fala com `localhost:3000`, então não é preciso habilitar CORS na API.
- **Inspetor somente leitura:** serviço FastAPI separado (`inspector/`), independente do código da API. Toda conexão ao banco é aberta com `default_transaction_read_only=on` e só executa `SELECT`; nomes de tabela e coluna são validados contra o `information_schema`.
- **Controle de containers restrito:** o inspetor só enxerga containers do próprio projeto Compose e só permite restart e logs de `pedidos` e `postgres` (qualquer outro serviço recebe 403). Não há stop, remove ou exec.
- O inspetor não publica porta, e o PostgreSQL continua sem porta publicada.

### Aviso de segurança

O inspetor monta o **Docker socket** (`/var/run/docker.sock`) e roda como root para poder usá-lo. Na prática, isso dá a ele controle sobre o Docker da máquina. As restrições acima limitam o que o código faz, mas o painel foi feito **só para uso local**: não o exponha em rede.

### Dados de teste

Os pedidos criados pelos Cenários, pela Máquina de estados e pelo Experimento usam o cliente com prefixo **`[teste-ui]`** e **permanecem no banco**, porque a API não tem DELETE e o inspetor é somente leitura. Para zerar tudo, use `docker compose --profile ui down -v` (apaga o volume e todos os pedidos).
