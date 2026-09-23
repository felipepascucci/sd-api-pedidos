# Plano de Desenvolvimento — API de Pedidos (Trabalho 1)

> Disciplina: Desenvolvimento de Sistemas Distribuídos — UNIP
> Este documento é a **única fonte de requisitos**. Tudo o que é necessário está aqui. Siga-o à risca; quando algo não estiver especificado, escolha a opção mais simples que respeite as regras deste plano e registre a decisão no README.

---

## 1. Contexto e objetivo

Construir a primeira versão de uma **API de Pedidos** que será evoluída ao longo da disciplina (depois virão serviços de Estoque, Pagamento, replicação, balanceamento etc.). O domínio é propositalmente pequeno: **a complexidade que importa é arquitetural, não comercial**. Código limpo, camadas bem separadas e execução reprodutível valem mais do que funcionalidades extras.

Arquitetura inicial:

```
Cliente --HTTP/JSON--> API de Pedidos (container "pedidos") --protocolo PostgreSQL--> PostgreSQL (container "postgres")
```

- A aplicação e o banco executam **separadamente** (containers distintos).
- Cliente ↔ API: HTTP/JSON.
- Aplicação ↔ banco: protocolo nativo do PostgreSQL (driver psycopg).
- O cliente acessa **somente** a porta publicada pela API (8000). O PostgreSQL **não** publica porta para o host.

---

## 2. Requisitos de entrega (obrigatórios, não negociáveis)

1. O repositório contém todo o código-fonte, configuração, `Dockerfile`, `docker-compose.yml`, documentação e demais elementos necessários.
2. A solução é **autocontida e reprodutível**: deve rodar numa máquina limpa (apenas Git + Docker instalados), sem depender de arquivos, bancos, bibliotecas, variáveis ou configurações que existam só na máquina de desenvolvimento.
3. O professor executará exatamente:
   ```bash
   git clone <URL_DO_REPOSITORIO>
   cd <NOME_DO_REPOSITORIO>
   git checkout APIPedidos-1-final
   docker compose up -d --build
   ```
   Esse último comando deve ser **suficiente** para construir e iniciar tudo (aplicação + PostgreSQL), **sem nenhum passo manual** (sem criar `.env`, sem rodar migração, sem criar tabela à mão).
4. A API deve responder em **http://localhost:8000**.
5. No `docker-compose.yml`, o serviço da aplicação chama-se **`pedidos`** e o do banco chama-se **`postgres`**.
6. A versão avaliada é identificada pela **tag Git** `APIPedidos-1-final` (tag anotada, **não** criar branch com esse nome — ver seção 14).
7. O `README.md` deve conter a identificação dos integrantes do grupo e tudo o que for necessário para compreender e executar a solução.

### Estrutura mínima exigida

```
/
├── app/
│   ├── main.py
│   ├── api/
│   ├── services/
│   ├── repositories/
│   ├── models/
│   └── schemas/
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .env.example
└── README.md
```

Outros arquivos/diretórios podem (e vão) ser adicionados.

---

## 3. Stack técnica

| Item | Escolha |
|---|---|
| Linguagem | Python 3.12 |
| Framework web | FastAPI |
| Servidor ASGI | Uvicorn |
| ORM | SQLAlchemy 2.0 (API síncrona, estilo `Mapped`/`mapped_column`) |
| Driver PostgreSQL | psycopg 3 (`psycopg[binary]`), URL no formato `postgresql+psycopg://...` |
| Validação | Pydantic v2 |
| Banco | PostgreSQL 16 (imagem oficial `postgres:16-alpine`) |
| Testes | pytest + httpx (TestClient do FastAPI) |
| Criação do schema | `Base.metadata.create_all()` no startup da aplicação (sem Alembic nesta versão) |

**Versões:** fixe versões exatas (`==`) em `requirements.txt` e `requirements-dev.txt`. Use versões estáveis e compatíveis entre si; confirme que instalam e funcionam dentro do container antes de finalizar. Não deixe dependências sem versão.

- `requirements.txt` (runtime): `fastapi`, `uvicorn[standard]`, `sqlalchemy`, `psycopg[binary]`, `pydantic`.
- `requirements-dev.txt` (testes): `-r requirements.txt`, `pytest`, `httpx`.

---

## 4. Estrutura final do projeto

```
/
├── app/
│   ├── __init__.py
│   ├── main.py                        # criação do FastAPI, lifespan (espera banco + create_all), routers
│   ├── config.py                      # leitura de variáveis de ambiente
│   ├── database.py                    # engine, SessionLocal, Base, get_db, espera pelo banco
│   ├── api/
│   │   ├── __init__.py
│   │   ├── pedidos.py                 # endpoints /pedidos
│   │   └── health.py                  # endpoint /health
│   ├── services/
│   │   ├── __init__.py
│   │   ├── pedido_service.py          # regras de negócio
│   │   └── exceptions.py              # exceções de domínio
│   ├── repositories/
│   │   ├── __init__.py
│   │   └── pedido_repository.py       # acesso ao banco
│   ├── models/
│   │   ├── __init__.py
│   │   └── pedido.py                  # modelo SQLAlchemy + enum StatusPedido
│   └── schemas/
│       ├── __init__.py
│       └── pedido.py                  # schemas Pydantic de entrada/saída
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   ├── unit/
│   │   ├── __init__.py
│   │   └── test_pedido_service.py
│   └── integration/
│       ├── __init__.py
│       └── test_pedidos_api.py
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── requirements-dev.txt
├── pytest.ini
├── .env.example
├── .gitignore
├── .dockerignore
├── .gitattributes
└── README.md
```

---

## 5. Arquitetura interna (três camadas lógicas)

**Camada não é container.** API, Service e Repository são camadas **lógicas** empacotadas juntas no mesmo processo/container `pedidos`. O PostgreSQL é outro container porque é outro processo/componente. A unidade de replicação futura será a aplicação de Pedidos **inteira** — por isso a aplicação deve ser **stateless** (nenhum estado em memória entre requisições; todo dado vive no banco).

### Responsabilidades e regras de dependência

| Camada | Arquivo | Responsabilidade | Pode | Não pode |
|---|---|---|---|---|
| API / Controller | `app/api/*.py` | Interface HTTP: recebe requisição, valida estrutura (via schemas Pydantic), chama o Service, traduz resultado/exceções em respostas HTTP | Importar schemas, service, `get_db` | Fazer queries SQL/ORM; conter regra de negócio |
| Service | `app/services/pedido_service.py` | Regras de negócio: calcula `valor_total`, define status inicial, valida transições de status, coordena operações | Chamar o Repository; lançar exceções de domínio | Importar nada de FastAPI (`HTTPException`, `Request` etc.); montar queries |
| Repository | `app/repositories/pedido_repository.py` | Encapsula o acesso ao banco (persistir, buscar, listar, atualizar) | Usar `Session` do SQLAlchemy | Conter regra de negócio; conhecer HTTP |

Fluxo de um `POST /pedidos`:
1. Cliente envia `POST /pedidos`.
2. **API** valida a estrutura recebida (schema `PedidoCreate`).
3. **Service** aplica as regras e calcula o valor total, define status `CRIADO`.
4. **Repository** persiste o pedido.
5. Banco confirma a operação (commit).
6. **API** retorna `201 Created` com o pedido criado.

### Injeção de dependências

- `get_db()` em `database.py`: gera uma `Session` por requisição (`yield`) e fecha no final.
- Na camada API, funções de dependência montam a cadeia: `get_pedido_service(db = Depends(get_db)) -> PedidoService(PedidoRepository(db))`.
- Isso permite, nos testes unitários, instanciar `PedidoService` com um repositório falso.

---

## 6. Modelo de dados

### Enum `StatusPedido` (em `app/models/pedido.py`)

```python
class StatusPedido(str, enum.Enum):
    CRIADO = "CRIADO"
    CONFIRMADO = "CONFIRMADO"
    CANCELADO = "CANCELADO"
```

(Novos estados poderão surgir em versões futuras, quando Estoque e Pagamento forem distribuídos — mantenha o enum fácil de estender.)

### Tabela `pedidos` (modelo SQLAlchemy `Pedido`)

| Campo | Tipo SQLAlchemy / PostgreSQL | Regras |
|---|---|---|
| `id` | `Integer`, PK, autoincremento | Identificador do pedido, gerado pelo banco |
| `cliente` | `String(255)`, not null | Identificação textual do cliente |
| `produto` | `String(255)`, not null | Identificação textual do produto |
| `quantidade` | `Integer`, not null | Quantidade solicitada; `CheckConstraint("quantidade > 0")` |
| `valor_unitario` | `Numeric(12, 2)`, not null | Preço de uma unidade; `CheckConstraint("valor_unitario > 0")` |
| `valor_total` | `Numeric(14, 2)`, not null | **Calculado pela aplicação** (Service) |
| `status` | `Enum(StatusPedido, native_enum=False, length=20)`, not null | Estado atual; armazenado como texto |
| `data_criacao` | `DateTime(timezone=True)`, not null, `server_default=func.now()` | Instante em que o pedido foi registrado |

Observações:
- Use `native_enum=False` para evitar criar um tipo ENUM do PostgreSQL (facilita evolução futura).
- Dinheiro sempre com `Decimal`, nunca `float`, em toda a cadeia interna.

---

## 7. Schemas Pydantic (`app/schemas/pedido.py`)

### `PedidoCreate` (entrada do POST)

| Campo | Tipo | Validação |
|---|---|---|
| `cliente` | `str` | obrigatório, remover espaços nas pontas, 1–255 caracteres após o strip |
| `produto` | `str` | obrigatório, remover espaços nas pontas, 1–255 caracteres após o strip |
| `quantidade` | `int` | obrigatório, `> 0` (use `StrictInt` ou `strict=True` para rejeitar `"5"` e `5.5`) |
| `valor_unitario` | `Decimal` | obrigatório, `> 0`, no máximo 2 casas decimais, `max_digits=12` |

- `model_config = ConfigDict(extra="forbid")`: o cliente **não pode** enviar `id`, `valor_total`, `status` ou `data_criacao` (a aplicação é quem define). Campos extras → `422`.

### `StatusUpdate` (entrada do PATCH)

| Campo | Tipo |
|---|---|
| `status` | `StatusPedido` (valor fora do enum → `422`) |

Também com `extra="forbid"`.

### `PedidoResponse` (saída)

Campos: `id`, `cliente`, `produto`, `quantidade`, `valor_unitario`, `valor_total`, `status`, `data_criacao`.
- `model_config = ConfigDict(from_attributes=True)`.
- `valor_unitario` e `valor_total` devem ser serializados no JSON como **número** (ex.: `59.9`), não como string. Use `Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]`.
- `data_criacao` em ISO 8601 com fuso (padrão do Pydantic para datetime com timezone).

### `HealthResponse`

`{"status": "ok"}`.

---

## 8. Regras de negócio (`PedidoService`)

### Criar pedido
- `valor_total = (quantidade * valor_unitario).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)`.
- Status inicial sempre `CRIADO` (definido pelo Service, nunca pelo cliente).
- Delega a persistência ao Repository e devolve o pedido persistido (com `id` e `data_criacao` preenchidos).

### Consultar pedido
- Busca por id. Se não existir, lança `PedidoNaoEncontradoError(pedido_id)`.
- Não altera o estado do pedido.

### Listar pedidos
- Retorna todos os pedidos, ordenados por `id` crescente. Sem paginação nesta versão.

### Alterar status — máquina de estados

Transições **permitidas**:

| De | Para |
|---|---|
| `CRIADO` | `CONFIRMADO` |
| `CRIADO` | `CANCELADO` |
| `CONFIRMADO` | `CANCELADO` |

Todas as demais são **inválidas**, incluindo:
- qualquer transição a partir de `CANCELADO` (estado final);
- qualquer transição para `CRIADO`;
- `CONFIRMADO → CONFIRMADO`, `CRIADO → CRIADO` (mesmo status).

Implemente a tabela de transições como um dicionário (ex.: `TRANSICOES_PERMITIDAS: dict[StatusPedido, set[StatusPedido]]`) para facilitar a evolução.

Fluxo: busca o pedido (não existe → `PedidoNaoEncontradoError`); se a transição é inválida → `TransicaoStatusInvalidaError(status_atual, novo_status)`; senão, atualiza **apenas** o campo `status` via Repository e devolve o pedido atualizado.

### Exceções de domínio (`app/services/exceptions.py`)
- `PedidoNaoEncontradoError`
- `TransicaoStatusInvalidaError`

A camada API as converte em HTTP (seção 9). O Service não conhece códigos HTTP.

---

## 9. Endpoints

Formato de erro: o padrão do FastAPI, `{"detail": "<mensagem em português>"}` (para 422 o FastAPI já gera a lista de erros de validação — manter o padrão).

Registre os routers com tags (`pedidos`, `health`) para a documentação automática em `/docs` ficar organizada.

### 9.1 Criar pedido — `POST /pedidos`

Requisição:
```json
{ "cliente": "Maria Silva", "produto": "Teclado", "quantidade": 2, "valor_unitario": 149.90 }
```
Respostas:
- `201 Created` + corpo `PedidoResponse` + header `Location: /pedidos/{id}`.
  ```json
  {
    "id": 1,
    "cliente": "Maria Silva",
    "produto": "Teclado",
    "quantidade": 2,
    "valor_unitario": 149.9,
    "valor_total": 299.8,
    "status": "CRIADO",
    "data_criacao": "2026-09-23T14:30:00.123456Z"
  }
  ```
- `422 Unprocessable Entity` para estrutura inválida (campo faltando, tipo errado, valores ≤ 0, strings vazias, campos extras).

### 9.2 Consultar pedido — `GET /pedidos/{id}`
- `id` no caminho, inteiro (não inteiro → `422`).
- `200 OK` + `PedidoResponse` quando existe.
- `404 Not Found` + `{"detail": "Pedido {id} não encontrado"}` quando não existe.
- Não altera o estado do pedido.

### 9.3 Listar pedidos — `GET /pedidos`
- `200 OK` + lista de `PedidoResponse` (lista vazia `[]` se não houver pedidos), ordenada por `id`.
- Sem paginação.

### 9.4 Alterar status — `PATCH /pedidos/{id}/status`

Requisição:
```json
{ "status": "CONFIRMADO" }
```
Respostas:
- `200 OK` + `PedidoResponse` atualizado.
- `404 Not Found` se o pedido não existe.
- `409 Conflict` + `{"detail": "Transição de status inválida: CANCELADO -> CONFIRMADO"}` se a transição não é permitida.
- `422` se o corpo for inválido (status fora do enum, campo ausente, campos extras).

Atualiza **apenas** o status.

### 9.5 Saúde — `GET /health`
- `200 OK` + `{"status": "ok"}`.
- Não é funcionalidade de negócio; será usado futuramente para disponibilidade, balanceamento e monitoramento. Mantenha-o leve e sem dependência do banco nesta versão.

---

## 10. Configuração por variáveis de ambiente

Endereço, porta, usuário e senha do banco **não podem** ficar fixos no código Python. A aplicação recebe a configuração do ambiente. A topologia poderá mudar sem alterar a lógica da aplicação. A API **não deve conhecer detalhes de replicação** do banco — ela só conhece uma URL de conexão.

### `app/config.py`
- Lê `DATABASE_URL` via `os.environ`. Se ausente, falhar no startup com mensagem clara (`RuntimeError("Variável de ambiente DATABASE_URL não definida")`).
- Opcional: `DB_CONNECT_RETRIES` (padrão `30`) e `DB_CONNECT_INTERVAL` (padrão `2` segundos) para a espera pelo banco.
- Não adicionar dependência extra (ex.: pydantic-settings) só para isso.

### `.env.example` (versionado, apenas referência)
```
POSTGRES_DB=pedidos
POSTGRES_USER=pedidos
POSTGRES_PASSWORD=pedidos
```
Comente no topo do arquivo que ele é opcional: o compose já tem valores padrão, e quem quiser personalizar pode copiá-lo para `.env`.

**Importante:** o `docker compose up -d --build` deve funcionar **sem** existir `.env`. Por isso o compose usa interpolação com padrão (`${POSTGRES_USER:-pedidos}`). O arquivo `.env` real vai no `.gitignore`.

---

## 11. `app/database.py` e `app/main.py`

### `database.py`
- `engine = create_engine(DATABASE_URL, pool_pre_ping=True)`.
- `SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)`.
- `class Base(DeclarativeBase)`.
- `get_db()` gerador de sessão.
- `wait_for_db(retries, interval)`: tenta `SELECT 1` em loop, registrando tentativas no log; se esgotar, levanta erro (o container reinicia pela política `restart`). Isso complementa o healthcheck do compose.

### `main.py`
- Usa `lifespan` (não o `@app.on_event`, que está depreciado):
  1. `wait_for_db()`;
  2. importa os models (para registrá-los no `Base.metadata`) e executa `Base.metadata.create_all(bind=engine)` — idempotente, cria a tabela só se não existir;
  3. `yield`.
- `app = FastAPI(title="API de Pedidos", version="1.0.0", lifespan=lifespan)`.
- Inclui os routers de `api/pedidos.py` e `api/health.py`.
- Registra handlers de exceção (ou trata no router) para `PedidoNaoEncontradoError → 404` e `TransicaoStatusInvalidaError → 409`.
- Configure `logging` básico (nível INFO).

---

## 12. Docker

Docker é ferramenta do laboratório: reproduz o ambiente, isola aplicação e banco, define rede/nomes entre componentes e facilita criar múltiplas instâncias no futuro.

### 12.1 `Dockerfile` (imagem da aplicação)

- Imagem-base `python:3.12-slim`.
- `ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1`.
- `WORKDIR /code`.
- `ARG INSTALL_DEV=false`.
- Copiar `requirements.txt` e `requirements-dev.txt` **antes** do código (cache de camadas); instalar `requirements.txt` sempre e `requirements-dev.txt` somente se `INSTALL_DEV=true`. Usar `--no-cache-dir`.
- Copiar `app/`, `tests/` e `pytest.ini`.
- Rodar como usuário não-root (criar usuário `appuser`).
- `EXPOSE 8000`.
- `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]`.
- **Não** colocar o PostgreSQL dentro desta imagem. A mesma imagem deve poder originar várias instâncias equivalentes.

### 12.2 `docker-compose.yml`

Requisitos:
- Serviços **`pedidos`** e **`postgres`** (nomes obrigatórios).
- **Não** usar `container_name` (atrapalharia criar múltiplas instâncias no futuro).
- **Não** usar a chave `version:` (obsoleta no Compose v2).
- Rede interna dedicada (ex.: `backend`) ligando os dois serviços.
- Volume nomeado (ex.: `postgres_data`) em `/var/lib/postgresql/data`.
- `postgres` **sem** `ports:` (não exposto ao host).
- `postgres` com `healthcheck` via `pg_isready`.
- `pedidos` com `depends_on: postgres: condition: service_healthy`, `ports: "8000:8000"` e `DATABASE_URL` apontando para o host `postgres`.
- `restart: unless-stopped` em ambos.
- Serviço extra **`tests`** no profile `test` (não sobe com `docker compose up`).

Referência:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-pedidos}
      POSTGRES_USER: ${POSTGRES_USER:-pedidos}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-pedidos}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - backend
    restart: unless-stopped

  pedidos:
    build: .
    environment:
      DATABASE_URL: postgresql+psycopg://${POSTGRES_USER:-pedidos}:${POSTGRES_PASSWORD:-pedidos}@postgres:5432/${POSTGRES_DB:-pedidos}
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - backend
    restart: unless-stopped

  tests:
    build:
      context: .
      args:
        INSTALL_DEV: "true"
    profiles: ["test"]
    environment:
      DATABASE_URL: postgresql+psycopg://${POSTGRES_USER:-pedidos}:${POSTGRES_PASSWORD:-pedidos}@postgres:5432/pedidos_test
      TEST_DATABASE_URL: postgresql+psycopg://${POSTGRES_USER:-pedidos}:${POSTGRES_PASSWORD:-pedidos}@postgres:5432/pedidos_test
      ADMIN_DATABASE_URL: postgresql+psycopg://${POSTGRES_USER:-pedidos}:${POSTGRES_PASSWORD:-pedidos}@postgres:5432/postgres
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - backend
    command: ["pytest", "-v"]

volumes:
  postgres_data:

networks:
  backend:
```

### 12.3 Arquivos auxiliares
- `.dockerignore`: `.git`, `.env`, `__pycache__/`, `*.pyc`, `.venv/`, `venv/`, `.pytest_cache/`, `.idea/`, `.vscode/`.
- `.gitignore`: os mesmos itens acima (exceto `.git`), mais arquivos de SO (`.DS_Store`, `Thumbs.db`).
- `.gitattributes`: `* text=auto eol=lf` (evita problemas de fim de linha se o professor clonar no Windows).

---

## 13. Testes automatizados

Executados **dentro do Docker**, sem instalar nada no host:

```bash
docker compose up -d --build            # garante que o postgres está no ar
docker compose --profile test run --rm tests
```

`pytest.ini`: `testpaths = tests`, `pythonpath = .`, `addopts = -ra`.

### 13.1 Testes unitários — `tests/unit/test_pedido_service.py`
Sem banco. Usar um `FakePedidoRepository` em memória (mesma interface do repositório real) injetado no `PedidoService`. Cobrir:
- cálculo de `valor_total` (inclusive arredondamento, ex.: `3 × 0.335`);
- status inicial `CRIADO`;
- consultar id inexistente → `PedidoNaoEncontradoError`;
- **todas** as transições permitidas (3) funcionam;
- transições inválidas lançam `TransicaoStatusInvalidaError` (a partir de `CANCELADO`, para `CRIADO`, para o mesmo status, `CONFIRMADO → CONFIRMADO`);
- alterar status de pedido inexistente → `PedidoNaoEncontradoError`;
- alterar status não modifica os demais campos.

### 13.2 Testes de integração — `tests/integration/test_pedidos_api.py`
Com PostgreSQL real, via `TestClient` do FastAPI, usando o banco **separado** `pedidos_test` (nunca o banco principal).

`tests/conftest.py`:
- Fixture de sessão (escopo `session`) que conecta em `ADMIN_DATABASE_URL` com `AUTOCOMMIT` e cria o banco `pedidos_test` se ele não existir (verificando em `pg_database`). Assim não depende de script de inicialização do volume.
- Cria as tabelas no banco de teste com `create_all`.
- Fixture por teste que limpa a tabela (`TRUNCATE pedidos RESTART IDENTITY`) para isolamento.
- `TestClient(app)` usado como context manager (dispara o lifespan).
- Se necessário, `app.dependency_overrides[get_db]` apontando para uma sessão do banco de teste.

Cobrir:
- `GET /health` → 200 e `{"status": "ok"}`;
- `POST /pedidos` → 201, header `Location`, `valor_total` calculado, `status == "CRIADO"`, `id` e `data_criacao` presentes;
- `POST` inválidos → 422 (campo faltando, quantidade 0/negativa, valor_unitario 0, cliente vazio/só espaços, campo extra `valor_total` ou `status`);
- `GET /pedidos/{id}` → 200 com os mesmos dados; id inexistente → 404; id não numérico → 422;
- `GET /pedidos` → lista vazia inicialmente; após criar 2 pedidos, retorna 2 em ordem de id;
- `PATCH /pedidos/{id}/status` → 200 nas transições válidas; 409 nas inválidas; 404 para inexistente; 422 para status fora do enum;
- persistência: após criar um pedido, abrir uma **nova** sessão/cliente e confirmar que o pedido continua lá.

Todos os testes devem passar antes da tag.

---

## 14. Git e entrega

**Regra principal: você (Claude Code) NÃO faz commits, NÃO faz push e NÃO cria branches.** Os commits e o push ficam a cargo do usuário. Sua única ação no Git é **criar a tag** de entrega, e somente quando o usuário pedir.

- Garanta que `.gitignore` impeça o versionamento de `.env`, credenciais reais, `__pycache__` e ambientes virtuais — assim o usuário pode commitar com segurança.
- **A entrega é uma TAG Git anotada**, não uma branch. **Não** crie branch chamada `APIPedidos-1-final` (tag e branch com o mesmo nome deixam o `git checkout` ambíguo).
- Quando terminar a implementação e o checklist da seção 15 (exceto a simulação de máquina limpa) passar, **pare e avise o usuário** que ele deve commitar tudo. Não prossiga até ele confirmar.
- Quando o usuário pedir a tag:
  1. Rode `git status`. Se houver qualquer alteração não commitada ou arquivo não rastreado que faça parte da solução, **pare e avise o usuário** — a tag aponta para um commit, e o que não estiver commitado não chega ao professor.
  2. Rode a simulação de máquina limpa da seção 15 a partir de um clone do repositório local (ela só enxerga o que está commitado, que é justamente o que será avaliado).
  3. Se tudo passar, crie a tag no commit atual:
     ```bash
     git tag -a APIPedidos-1-final -m "Entrega Trabalho 1 - API de Pedidos"
     ```
  4. Informe o usuário que a tag foi criada **localmente** e que ele precisa enviá-la ao remoto com `git push origin APIPedidos-1-final` (além do push da branch principal, se ainda não tiver feito). Você não executa esses pushes.
- Se a tag já existir, **não** a sobrescreva: avise o usuário e só recrie (`git tag -fa ...`) se ele pedir explicitamente.

---

## 15. Checklist de aceite (validar tudo antes da tag)

Critérios mínimos de funcionamento definidos pelo professor:
- [ ] `docker compose up -d --build` inicia aplicação e banco, sem passo manual e **sem** arquivo `.env`.
- [ ] `POST /pedidos` persiste um pedido.
- [ ] `GET /pedidos/{id}` recupera o pedido persistido.
- [ ] `GET /pedidos` lista os pedidos.
- [ ] `GET /health` informa que a aplicação está operacional.
- [ ] Reiniciar a API **não** apaga os pedidos.

Verificações adicionais:
- [ ] `PATCH /pedidos/{id}/status` respeita a máquina de estados (200/404/409/422).
- [ ] `docker compose --profile test run --rm tests` → todos os testes passam.
- [ ] Porta 5432 **não** está publicada no host (`docker compose ps` mostra só a 8000).
- [ ] Nenhuma credencial/endereço de banco fixo no código Python (`grep` por `localhost`, `5432`, senhas em `app/`).
- [ ] Nenhuma camada viola as regras da seção 5 (Service sem FastAPI; API sem queries).
- [ ] README completo (seção 17).

**Simulação de máquina limpa** (obrigatória, repetir o que o professor fará):
```bash
docker compose down -v                      # derruba o ambiente de desenvolvimento e apaga o volume
cd /tmp && rm -rf verificacao
git clone <caminho-absoluto-do-repo-local> verificacao && cd verificacao
# o clone traz só o que está commitado; se a tag já existir, rode também: git checkout APIPedidos-1-final
docker compose up -d --build
# aguardar e testar os endpoints com curl (seção 15.1)
docker compose down -v
```

### 15.1 Experimento de persistência (reproduzir e documentar)
```bash
curl -s -X POST http://localhost:8000/pedidos -H "Content-Type: application/json" \
  -d '{"cliente":"Maria","produto":"Teclado","quantidade":2,"valor_unitario":149.90}'
curl -s http://localhost:8000/pedidos/1
docker compose restart pedidos              # reinicia SOMENTE o container da aplicação
curl -s http://localhost:8000/pedidos/1     # o pedido continua lá
```

---

## 16. Sequência de implementação

1. Criar a estrutura do projeto (pastas, `__init__.py`, `.gitignore`, `.dockerignore`, `.gitattributes`, requirements).
2. Implementar o modelo `Pedido`, o enum `StatusPedido` e os schemas.
3. Configurar a conexão com PostgreSQL (`config.py`, `database.py`).
4. Implementar Repository e Service (com exceções de domínio).
5. Implementar os endpoints FastAPI e o `main.py` (lifespan, routers, handlers de erro).
6. Criar `Dockerfile` e `docker-compose.yml`.
7. Subir o ambiente e testar os endpoints manualmente (curl).
8. Escrever os testes unitários e de integração; rodá-los no container.
9. Escrever o `README.md`.
10. Rodar o checklist da seção 15 (exceto a simulação de máquina limpa) e **parar**, avisando o usuário para commitar e fazer push.
11. Quando o usuário pedir: verificar `git status`, rodar a simulação de máquina limpa e criar a tag localmente (seção 14). O push da tag é do usuário.

---

## 17. Conteúdo do `README.md`

Em português, com as seções:

1. **Título e descrição** — API de Pedidos, Trabalho 1 de Desenvolvimento de Sistemas Distribuídos (UNIP).
2. **Integrantes do grupo** — tabela Nome | RA. Deixar exatamente este marcador para o usuário preencher:
   `<!-- PREENCHER: nomes e RAs dos integrantes -->` com uma tabela de exemplo vazia.
3. **Arquitetura** — diagrama (bloco Mermaid ou ASCII) Cliente → pedidos → postgres; explicação das três camadas lógicas vs. dois containers; por que a aplicação é stateless; rede interna e volume.
4. **Estrutura do repositório** — árvore comentada.
5. **Pré-requisitos** — apenas Git e Docker (com Docker Compose v2).
6. **Como executar** — os comandos exatos do professor (clone, checkout da tag, `docker compose up -d --build`); URL `http://localhost:8000`; documentação interativa em `http://localhost:8000/docs`.
7. **Configuração** — variáveis, valores padrão, uso opcional do `.env.example`.
8. **Endpoints** — tabela método/rota/descrição/códigos + exemplos curl de cada um (com resposta de exemplo).
9. **Modelo de pedido e máquina de estados** — campos e tabela de transições (e observação de que novos estados virão com Estoque e Pagamento).
10. **Testes** — como executar e o que cobrem.
11. **Experimento: o dado está onde?** — passo a passo da seção 15.1 e a resposta à pergunta "por que o dado permaneceu?": o pedido não fica na memória da aplicação, e sim no PostgreSQL, que é outro processo em outro container; os arquivos do banco estão num volume Docker nomeado, que existe independentemente do ciclo de vida dos containers; reiniciar o container `pedidos` não afeta nem o container `postgres` nem o volume, e como a API é stateless ela apenas reconecta e lê os dados. Mencionar que `docker compose down -v` removeria o volume e, aí sim, apagaria os dados.
12. **Parar e limpar** — `docker compose down` (mantém dados) e `docker compose down -v` (apaga dados).
13. **Decisões técnicas** — lista curta das escolhas (SQLAlchemy síncrono, `create_all` sem migrações, `Decimal` para dinheiro, 409 para transição inválida, porta do banco não exposta, etc.).

---

## 18. Fora do escopo desta versão

Não implementar: autenticação, paginação, Alembic/migrações, serviços de Estoque ou Pagamento, mensageria, múltiplas réplicas, load balancer, cache. Esses itens virão em trabalhos futuros — mas o código deve estar organizado para recebê-los sem reescrita (camadas separadas, configuração por ambiente, aplicação stateless).
