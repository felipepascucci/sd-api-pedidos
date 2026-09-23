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
├── docs/plano_desenvolvimento.md  # plano/requisitos do trabalho
├── Dockerfile                     # imagem da aplicação
├── docker-compose.yml             # serviços pedidos, postgres e tests (profile test)
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

O cliente não pode enviar `id`, `valor_total`, `status` ou `data_criacao`: campos extras resultam em `422`. Também dão `422`: campo obrigatório ausente, `quantidade` não inteira ou ≤ 0, `valor_unitario` ≤ 0 ou com mais de 2 casas decimais, `cliente`/`produto` vazios ou só com espaços.

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
| `id` | inteiro | gerado pelo banco |
| `cliente` | texto (até 255) | obrigatório |
| `produto` | texto (até 255) | obrigatório |
| `quantidade` | inteiro | > 0 |
| `valor_unitario` | decimal (12,2) | > 0 |
| `valor_total` | decimal (14,2) | calculado pela aplicação: `quantidade × valor_unitario`, arredondado para 2 casas (ROUND_HALF_UP) |
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
docker compose --profile test run --rm tests
```

O serviço `tests` pertence ao profile `test`, então não sobe com `docker compose up`. Ele usa o banco separado `pedidos_test` (criado automaticamente pelo `conftest.py`), nunca o banco principal.

- **Unitários** (`tests/unit/`): testam o `PedidoService` com um repositório falso em memória, sem banco. Cobrem cálculo e arredondamento do `valor_total` (ex.: `3 × 0.335 = 1.01`), status inicial `CRIADO`, pedido inexistente, todas as transições permitidas, as transições inválidas e que alterar o status não modifica os demais campos.
- **Integração** (`tests/integration/`): testam a API via `TestClient` com PostgreSQL real. Cobrem `/health`, criação (201, `Location`, total, status), validações (422), consulta (200/404/422), listagem (vazia e ordenada), alteração de status (200/404/409/422) e persistência (o pedido é lido por uma nova sessão e por um novo cliente).

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
- **Campos extras proibidos** (`extra="forbid"`) na entrada: `id`, `valor_total`, `status` e `data_criacao` são sempre definidos pela aplicação/banco.
- **Porta do banco não exposta ao host**: só a API é pública; o banco fica na rede interna `backend`.
- **Sem `container_name`** no compose, para permitir múltiplas instâncias no futuro.
- **Container da aplicação roda como usuário não-root** (`appuser`).
- **Banco de testes separado** (`pedidos_test`), criado pelos próprios testes.
