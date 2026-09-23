# Plano de Desenvolvimento — Painel de Testes da API de Pedidos (UI)

> Este documento é **autocontido**: tudo o que você (Claude Code) precisa saber está aqui. Ele complementa o `PLANO_DESENVOLVIMENTO.md` (a API de Pedidos), que deve estar **concluído e com testes passando** antes de você começar este plano.
>
> A UI **não** é exigência do professor. É uma ferramenta opcional do grupo para testar, visualizar e demonstrar a API. Por isso ela **não pode, em hipótese alguma, interferir** na entrega avaliada.

---

## 1. Objetivo

Criar um painel web moderno, em React, que permita:

- ver o estado da infraestrutura (API, banco e containers) em tempo real;
- testar **todos** os endpoints da API, vendo a requisição e a resposta completas, com as mensagens de sucesso e de erro;
- ver o banco de dados **diretamente**, ou seja, o conteúdo real da tabela e o seu schema, não apenas o que a API devolve;
- executar uma bateria de cenários de validação com resultado passou/falhou;
- reiniciar containers e conduzir o experimento de persistência ("o dado está onde?") pela interface;
- manter um histórico de todas as chamadas feitas.

---

## 2. Regras invioláveis

1. **Não alterar nada em `app/`, `tests/`, `Dockerfile` raiz, `requirements*.txt` ou `pytest.ini`.** A API de Pedidos permanece exatamente como está. A UI se adapta à API, nunca o contrário (não adicionar CORS, endpoints de debug etc.).
2. No `docker-compose.yml`, **não alterar** os serviços `pedidos`, `postgres` e `tests`. Apenas **adicionar** os novos serviços `ui` e `inspector`, ambos no profile `ui`.
3. O comando do professor, `docker compose up -d --build`, deve continuar subindo **somente** `pedidos` e `postgres`, sem construir nem iniciar a UI ou o inspetor.
4. O inspetor acessa o banco em modo **somente leitura**. Nenhuma escrita no banco pode partir dele.
5. O controle de containers do inspetor se limita a **status, logs e restart** dos serviços `pedidos` e `postgres`. Nada de stop, remove, exec, criação de containers ou acesso a outros projetos Docker.
6. **Git:** você NÃO faz commits, push, branches nem tags. Ao terminar, pare e avise o usuário que ele deve commitar.
7. Tudo deve funcionar numa máquina limpa, só com Git e Docker. Nada de dependências instaladas no host, fontes carregadas de CDN ou recursos externos em tempo de execução.

---

## 3. Contrato da API de Pedidos (referência para a UI)

Base interna: `http://pedidos:8000` (na rede Docker). A UI a acessa sempre via o proxy `/api` (seção 5).

| Método | Rota | Corpo | Sucesso | Erros |
|---|---|---|---|---|
| GET | `/health` | — | 200 `{"status":"ok"}` | — |
| POST | `/pedidos` | `{"cliente","produto","quantidade","valor_unitario"}` | 201 + pedido + header `Location: /pedidos/{id}` | 422 |
| GET | `/pedidos` | — | 200 lista ordenada por id (pode ser `[]`) | — |
| GET | `/pedidos/{id}` | — | 200 pedido | 404, 422 (id não inteiro) |
| PATCH | `/pedidos/{id}/status` | `{"status": "..."}` | 200 pedido atualizado | 404, 409 (transição inválida), 422 |

Pedido retornado:
```json
{
  "id": 1, "cliente": "Maria", "produto": "Teclado", "quantidade": 2,
  "valor_unitario": 149.9, "valor_total": 299.8, "status": "CRIADO",
  "data_criacao": "2026-09-23T14:30:00.123456Z"
}
```

Regras de validação do POST: todos os campos obrigatórios; `cliente` e `produto` com 1 a 255 caracteres após remover espaços das pontas; `quantidade` inteiro estrito maior que 0; `valor_unitario` maior que 0, com no máximo 2 casas decimais; campos extras (ex.: `status`, `valor_total`, `id`) geram 422. O `valor_total` é calculado pela API como `quantidade × valor_unitario`, arredondado para 2 casas com ROUND_HALF_UP. O status inicial é sempre `CRIADO`.

Máquina de estados (transições permitidas):

| De | Para |
|---|---|
| CRIADO | CONFIRMADO |
| CRIADO | CANCELADO |
| CONFIRMADO | CANCELADO |

Todo o resto dá 409: sair de `CANCELADO`, ir para `CRIADO` ou repetir o mesmo status.

Formato de erro: `{"detail": "mensagem"}` para 404 e 409. Para 422, `detail` é uma lista no padrão FastAPI/Pydantic, com itens contendo `loc`, `msg` e `type`.

> Se, ao ler o código em `app/`, você encontrar alguma diferença em relação a esta tabela, **o código da API é a verdade**. Adapte a UI e avise o usuário da divergência.

---

## 4. Arquitetura

```
Navegador ──> ui (nginx :80, publicado em localhost:3000)
                ├── /            → arquivos estáticos do React
                ├── /api/*       → http://pedidos:8000/*     (API de Pedidos, sem alteração)
                └── /inspector/* → http://inspector:8001/*   (serviço novo, não publicado)

inspector ──> postgres:5432 (leitura, transação read-only)
inspector ──> /var/run/docker.sock (status, logs, restart de pedidos/postgres)
```

- O proxy do nginx elimina a necessidade de CORS: o navegador só fala com a origem `localhost:3000`.
- O inspetor **não** publica porta no host; só a UI o acessa, via proxy.
- O PostgreSQL continua sem porta publicada.

---

## 5. Serviço `ui` (React + nginx)

### 5.1 Stack

| Item | Escolha |
|---|---|
| Build | Vite |
| Linguagem | TypeScript (modo `strict`) |
| UI | React |
| Estilo | Tailwind CSS + shadcn/ui (componentes Radix) |
| Ícones | lucide-react |
| Dados/polling | TanStack Query |
| Rotas | react-router |
| Estado global (histórico) | zustand, com persistência em `localStorage` |
| Notificações | sonner (toasts) |
| Fonte | Inter via `@fontsource-variable/inter` (empacotada no build, sem Google Fonts) |
| Fonte mono | JetBrains Mono via `@fontsource` (para JSON, SQL e logs) |
| Testes | Vitest (funções puras) |

Use versões atuais e compatíveis entre si. **Versione o `package-lock.json`** e use `npm ci` no Docker, para builds reprodutíveis. Inicialize o shadcn/ui pela CLI oficial (gerando `components.json`) e adicione somente os componentes usados.

### 5.2 Estrutura

```
ui/
├── Dockerfile
├── .dockerignore              # node_modules, dist
├── nginx.conf
├── package.json
├── package-lock.json
├── components.json
├── index.html
├── vite.config.ts
├── tsconfig*.json
└── src/
    ├── main.tsx
    ├── App.tsx                # layout + rotas
    ├── index.css              # Tailwind + tokens de tema
    ├── lib/
    │   ├── http.ts            # wrapper único de fetch: mede tempo, captura headers/corpo, registra no histórico
    │   ├── pedidos-api.ts     # funções tipadas para cada endpoint da API
    │   ├── inspector-api.ts   # funções tipadas para o inspetor
    │   ├── status.ts          # enum, cores e tabela de transições (espelho da seção 3)
    │   ├── curl.ts            # gera comando curl equivalente (apontando para localhost:8000)
    │   └── format.ts          # moeda BRL, datas, duração
    ├── stores/
    │   └── history.ts         # zustand: histórico de requisições
    ├── scenarios/
    │   ├── definitions.ts     # cenários de validação (seção 7.5)
    │   └── runner.ts          # executor com asserções
    ├── components/
    │   ├── ui/                # shadcn
    │   ├── layout/            # Sidebar, Topbar, ThemeToggle
    │   ├── JsonViewer.tsx     # JSON formatado, com destaque de sintaxe e botão copiar
    │   ├── HttpStatusBadge.tsx
    │   ├── PedidoStatusBadge.tsx
    │   ├── RequestResponsePanel.tsx
    │   └── StateMachineDiagram.tsx
    ├── pages/                 # uma página por item da seção 7
    └── test/                  # testes Vitest
```

### 5.3 Wrapper HTTP (`lib/http.ts`)

**Toda** chamada da UI, tanto para a API quanto para o inspetor, passa por este wrapper. Ele:

- registra método, URL, corpo enviado, status, headers de resposta, corpo de resposta (JSON ou texto), duração em ms, horário e origem (`api` ou `inspector`);
- **nunca lança exceção** por status HTTP de erro: retorna um objeto de resultado. Erros de rede (API fora do ar, 502 do nginx) viram resultado com `status: null` e mensagem clara;
- salva o registro no store de histórico (máximo de 500 itens, descartando os mais antigos);
- pode, opcionalmente, disparar um toast.

Chamadas de polling automático (health, status dos containers, auto-refresh) devem ser marcadas como `silent`: não geram toast e não entram no histórico. Caso contrário, poluiriam o histórico.

### 5.4 Dockerfile (multi-stage)

1. Estágio `build` a partir de `node:22-alpine`: `npm ci`, `npm run test -- --run` (Vitest), `npm run build` (inclui checagem de tipos `tsc`). Se testes ou tipos falharem, o build falha.
2. Estágio final a partir de `nginx:alpine`: copiar `dist/` para `/usr/share/nginx/html` e o `nginx.conf`.

### 5.5 `nginx.conf`

- Servir a SPA com fallback `try_files $uri /index.html`.
- Usar `resolver 127.0.0.11 valid=10s;` (DNS interno do Docker) e **proxy_pass com variável**, para o nginx não falhar no start se `pedidos` ou `inspector` estiverem fora do ar (e continuar funcionando depois que o `pedidos` reiniciar):
  ```nginx
  location /api/ {
      set $pedidos_upstream pedidos:8000;
      rewrite ^/api/(.*)$ /$1 break;
      proxy_pass http://$pedidos_upstream;
  }
  location /inspector/ {
      set $inspector_upstream inspector:8001;
      rewrite ^/inspector/(.*)$ /$1 break;
      proxy_pass http://$inspector_upstream;
  }
  ```
- Repassar os headers `Host` e `X-Real-IP`, sem reescrever o header `Location` da resposta (a UI o exibe como a API o envia).
- `proxy_read_timeout` de pelo menos 60 s (restart de container pode demorar).
- Quando o upstream estiver fora, o nginx responde 502. A UI deve tratar esse caso como "API indisponível", e não como erro da aplicação.

---

## 6. Serviço `inspector` (FastAPI, somente leitura + controle de containers)

### 6.1 Stack e estrutura

Python 3.12, FastAPI, Uvicorn, `psycopg[binary]` (sem ORM) e o SDK `docker` para Python. Fixe as versões com `==`.

```
inspector/
├── Dockerfile
├── requirements.txt
└── app/
    ├── __init__.py
    ├── main.py          # FastAPI + rotas
    ├── db.py            # conexão read-only e queries de introspecção
    └── docker_ctl.py    # status, logs e restart via Docker SDK
```

Este código é independente de `app/` da API de Pedidos. Não importe nada de lá.

### 6.2 Acesso ao banco (read-only)

- Variável `DATABASE_URL` (mesmas credenciais do compose) no formato `postgresql://...` (psycopg puro).
- Toda conexão é aberta com `options="-c default_transaction_read_only=on"`, e o código usa somente `SELECT`. Assim, mesmo um bug não consegue escrever no banco.
- Abra uma conexão nova por requisição (simples e robusto a restarts do postgres) com `connect_timeout=3`. Se o banco estiver fora, responda 503 com `detail` claro.
- **Nunca** montar SQL por concatenação de string. Nome de tabela e de coluna vindos da URL devem ser validados contra a lista real obtida de `information_schema` e inseridos com `psycopg.sql.Identifier`.
- Restringir ao schema `public`.

### 6.3 Controle de containers

- Montar `/var/run/docker.sock` no container. Isso funciona no Linux e no Docker Desktop (Windows e Mac).
- Descobrir o próprio projeto Compose: `client.containers.get(socket.gethostname())` → label `com.docker.compose.project`. Operar **apenas** em containers com esse mesmo label de projeto.
- Localizar serviços pelo label `com.docker.compose.service`.
- Allowlist de restart e logs: `{"pedidos", "postgres"}`. Qualquer outro serviço → 403.
- Status (leitura) pode listar todos os serviços do projeto: `pedidos`, `postgres`, `inspector`, `ui`.
- Restart: `container.restart(timeout=10)`, em endpoint síncrono (`def`, não `async def`, para rodar no threadpool).

### 6.4 Endpoints do inspetor

| Método | Rota | Retorno |
|---|---|---|
| GET | `/health` | `{"status":"ok"}` |
| GET | `/db/info` | versão do PostgreSQL, nome do banco, tamanho do banco (formatado), número de conexões ativas, valor de `default_transaction_read_only` da sessão (deve ser `on`), horário do servidor |
| GET | `/db/tables` | tabelas do schema `public`, com contagem exata de linhas (`count(*)`) |
| GET | `/db/tables/{tabela}/schema` | colunas (nome, tipo, nullable, default, posição), constraints (tipo, nome e definição via `pg_get_constraintdef`, incluindo os CHECKs de quantidade e valor), índices (`pg_indexes`) |
| GET | `/db/tables/{tabela}/rows?limit=50&offset=0&order_by=id&direction=asc` | `{"columns": [...], "rows": [...], "total": N}`. `limit` máximo de 500; `order_by` validado; valores numéricos como número e datas em ISO |
| GET | `/docker/containers` | por serviço: nome do container, serviço, estado (running/restarting/exited), health (se houver), `started_at`, imagem, `restart_count`, portas publicadas |
| POST | `/docker/containers/{servico}/restart` | executa o restart e devolve o novo `started_at` e o tempo gasto em ms |
| GET | `/docker/containers/{servico}/logs?tail=200` | últimas N linhas (máximo 1000), com timestamps |

Erros no formato `{"detail": "..."}`: 403 (serviço fora da allowlist), 404 (tabela ou serviço inexistente), 503 (banco ou Docker indisponível).

### 6.5 Dockerfile

`python:3.12-slim`, instalar `requirements.txt`, copiar `app/`, `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]`. Rode como **root**, pois precisa de permissão no Docker socket. Documente isso como aceitável por ser uma ferramenta local e opcional.

---

## 7. Funcionalidades da UI (páginas)

Layout: sidebar fixa à esquerda com as páginas abaixo e ícones; topbar com indicadores compactos de saúde (API, Banco, Docker) sempre visíveis e alternador de tema.

### 7.1 Visão geral (Dashboard)
- Cards de status com polling a cada 5 s: **API** (`/api/health`, com latência), **Banco** (`/inspector/db/info`), **Containers** (`/inspector/docker/containers`). Cores: verde (ok), âmbar (degradado/reiniciando), vermelho (fora).
- **Diagrama de arquitetura ao vivo**: Navegador → pedidos → postgres (e o volume), com cada nó colorido conforme o status atual e as setas indicando HTTP/JSON e protocolo PostgreSQL.
- Métricas: total de pedidos, quantidade por status, soma de `valor_total` (em BRL), pedido mais recente.
- Últimas 10 requisições do histórico.

### 7.2 Pedidos
- Tabela com os dados de `GET /pedidos`: busca por cliente/produto, filtro por status, ordenação por coluna e badges coloridos por status.
- Botão **Novo pedido**, que abre um diálogo com formulário:
  - prévia do `valor_total` calculada enquanto o usuário digita (apenas informativa);
  - **sem bloqueio de validação no cliente** por padrão: o formulário envia o que foi digitado, para que as validações da API apareçam. Um switch "Validar antes de enviar" pode ativar a validação local;
  - erros 422 mapeados para os campos correspondentes (usando `loc`), com a mensagem da API abaixo de cada campo.
- Clique na linha abre um painel lateral com os detalhes via `GET /pedidos/{id}` (chamada real, registrada no histórico).
- Ações de status no painel: botões para **todos** os status. Os permitidos pela máquina de estados ficam em destaque; os proibidos ficam disponíveis com o aviso "esperado: 409", para que o usuário possa testar o erro.
- Toda ação exibe um toast com o código HTTP e a mensagem (sucesso ou `detail` do erro).

### 7.3 Console de API
Um "Postman" embutido:
- Seletor de presets (um por endpoint) que preenche método, caminho e corpo de exemplo.
- Campos editáveis: método (GET/POST/PATCH e também PUT/DELETE, para ver o 405 da API), caminho livre e corpo JSON em editor monoespaçado, com botão "Formatar" e aviso de JSON inválido (permitindo enviar mesmo assim, como texto cru, para testar a API).
- Painel de resposta: badge do status (2xx verde, 4xx âmbar, 5xx vermelho, erro de rede roxo), tempo em ms, tamanho, headers (com destaque para `Location`) e corpo formatado.
- Botões "Copiar como curl" (apontando para `http://localhost:8000`) e "Copiar resposta".

### 7.4 Banco de dados
- Card de informações do `/db/info`, com selo **"Somente leitura"** quando `default_transaction_read_only = on`.
- Lista de tabelas com contagem de linhas.
- Aba **Schema**: colunas (tipo, nullable, default), constraints (PK e CHECKs, com a definição SQL exibida em fonte mono) e índices.
- Aba **Dados**: grid paginado e ordenável com as linhas **reais** do banco; toggle de auto-refresh (2 s); linhas novas ou alteradas desde a última leitura destacadas por alguns segundos (comparando pelo `id` e pelo conteúdo).
- Nota explicativa: "Estes dados vêm direto do PostgreSQL pelo inspetor, não pela API de Pedidos."

### 7.5 Cenários de validação
Lista de cenários automatizados, cada um com: nome, descrição, passos (requisições), resultado esperado e resultado obtido. Botões "Executar todos" e "Executar" individual. Mostrar progresso, contagem de passou/falhou e, para cada falha, o esperado vs. o obtido, com a requisição/resposta completas.

Todo pedido criado pelos cenários deve usar o cliente prefixado com `[teste-ui]`, para ser identificável (a API não tem DELETE e o inspetor é somente leitura, então esses registros permanecem). Mostre esse aviso na página.

Cenários obrigatórios:

**Saúde e criação**
1. `GET /health` → 200 e `{"status":"ok"}`.
2. Criar pedido válido → 201; `status == "CRIADO"`; `valor_total` correto; header `Location` igual a `/pedidos/{id}`; `id` e `data_criacao` presentes.
3. Precisão decimal (valores que dariam erro com float binário): `quantidade 3 × valor_unitario 0.35` → `valor_total 1.05`; `quantidade 7 × valor_unitario 1.15` → `8.05`.

**Validação (todos → 422)**
4. Campo obrigatório ausente (um cenário por campo: cliente, produto, quantidade, valor_unitario).
5. `quantidade` = 0, negativa, decimal (`2.5`) e string (`"2"`).
6. `valor_unitario` = 0, negativo e com 3 casas decimais (`10.999`).
7. `cliente` vazio e só com espaços; `produto` vazio.
8. `cliente` com 256 caracteres.
9. Campos extras: `status`, `valor_total` e `id` enviados no corpo.
10. Corpo que não é JSON válido.

**Consulta e listagem**
11. `GET /pedidos/{id}` do pedido criado → 200 e dados idênticos aos da criação.
12. `GET /pedidos/999999999` → 404 com `detail`.
13. `GET /pedidos/abc` → 422.
14. `GET /pedidos` → 200, é uma lista, contém o pedido criado e está ordenada por `id`.

**Máquina de estados**
15. Transições válidas: CRIADO→CONFIRMADO, CRIADO→CANCELADO, CONFIRMADO→CANCELADO → 200, e o novo status é refletido num `GET` posterior.
16. Transições inválidas → 409: CANCELADO→CONFIRMADO, CANCELADO→CRIADO, CONFIRMADO→CRIADO, CRIADO→CRIADO, CONFIRMADO→CONFIRMADO, CANCELADO→CANCELADO.
17. Após um 409, o status do pedido **não mudou**.
18. PATCH com status inexistente (`"ENVIADO"`) → 422; PATCH em id inexistente → 404.
19. PATCH altera **apenas** o status (demais campos idênticos antes e depois).

**Consistência com o banco (via inspetor)**
20. Após criar um pedido pela API, a linha correspondente existe na tabela `pedidos` do banco, com os mesmos valores.
21. O schema do banco contém as constraints CHECK de `quantidade > 0` e `valor_unitario > 0`.
22. Contagem de `GET /pedidos` igual ao `count(*)` da tabela.

Implemente os cenários de forma declarativa em `scenarios/definitions.ts` (cada um é uma função assíncrona que usa `pedidos-api`/`inspector-api` e um pequeno conjunto de asserções: `expectStatus`, `expectEqual`, `expectTrue`), para ser fácil adicionar novos no futuro.

### 7.6 Máquina de estados
- Diagrama SVG próprio (sem biblioteca pesada) com os três estados e as setas das transições permitidas, com estados finais marcados.
- Seletor de pedido: destaca o estado atual dele no diagrama; clicar num estado de destino dispara o PATCH real e anima o resultado (a seta fica verde em caso de sucesso; em caso de 409, um "X" vermelho com a mensagem da API).
- Nota: "Novos estados surgirão quando Estoque e Pagamento forem distribuídos."

### 7.7 Infraestrutura
- Card por serviço (`pedidos`, `postgres`, `inspector`, `ui`): estado, health, uptime (derivado de `started_at`), imagem, número de restarts e portas publicadas. O card do `postgres` deve evidenciar "sem porta publicada".
- Botão **Reiniciar** em `pedidos` e `postgres`, com diálogo de confirmação e spinner. Os demais serviços não têm botão.
- Visualizador de logs por serviço (`pedidos`, `postgres`): tail configurável (100/200/500), polling de 3 s opcional, rolagem automática, fonte mono e botão copiar.

### 7.8 Experimento de persistência (assistente guiado)
Reproduz o experimento da disciplina em etapas, com uma timeline visual:

1. **Criar pedido** pela API (cliente `[teste-ui] experimento`).
2. **Consultar** o pedido pela API e mostrar os dados.
3. **Reiniciar somente o container `pedidos`** via inspetor.
4. **Acompanhar a indisponibilidade**: fazer polling de `/api/health` a cada 500 ms, registrando o momento em que a API caiu e o momento em que voltou, e exibindo o tempo de indisponibilidade. Mostrar também que, durante esse intervalo, o inspetor continua lendo o pedido no banco.
5. **Consultar novamente** o mesmo pedido e comparar campo a campo com a etapa 2.
6. **Conclusão**, com o resultado (✅ dado preservado) e a explicação: o pedido não fica na memória da aplicação, e sim no PostgreSQL, que é outro processo em outro container; os arquivos do banco ficam num volume Docker nomeado, independente do ciclo de vida dos containers; como a API é stateless, ao voltar ela apenas reconecta e lê os dados.

Botão opcional "Repetir reiniciando o `postgres`", que demonstra que os dados sobrevivem também ao restart do banco, graças ao volume.

### 7.9 Histórico
- Lista de todas as requisições não-silenciosas (API e inspetor), com filtros por origem, método, faixa de status (2xx/4xx/5xx/rede) e busca por caminho.
- Clique abre o detalhe completo (mesmo `RequestResponsePanel` do console), com ações "Reenviar" e "Copiar como curl".
- Botão para limpar o histórico. Persistido em `localStorage`.

---

## 8. Design

- Visual moderno e limpo, no estilo de ferramentas de desenvolvedor (referências: Vercel, Linear, Supabase Studio).
- **Tema escuro por padrão**, com alternância para claro, persistida em `localStorage`. Cores definidas como tokens CSS do shadcn.
- Tipografia: Inter para interface; JetBrains Mono para JSON, SQL, logs, IDs e caminhos.
- Cores semânticas consistentes em toda a UI:
  - status do pedido: CRIADO = azul, CONFIRMADO = verde, CANCELADO = vermelho;
  - HTTP: 2xx = verde, 4xx = âmbar, 5xx = vermelho, erro de rede = roxo;
  - saúde: ok = verde, reiniciando = âmbar, fora = vermelho.
- Cards com bordas sutis, cantos arredondados, sombras discretas e bom espaçamento; skeletons durante carregamento; estados vazios com ícone e texto explicativo.
- Valores monetários em BRL (`R$ 1.234,56`); datas em `dd/MM/yyyy HH:mm:ss` no fuso local.
- Responsivo: sidebar recolhível em telas estreitas; tabelas largas com rolagem horizontal própria.
- Interface toda em português.

---

## 9. docker-compose.yml — o que adicionar

Adicionar **somente** os dois serviços abaixo (sem mexer nos existentes):

```yaml
  inspector:
    build: ./inspector
    profiles: ["ui"]
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-pedidos}:${POSTGRES_PASSWORD:-pedidos}@postgres:5432/${POSTGRES_DB:-pedidos}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - backend
    restart: unless-stopped

  ui:
    build: ./ui
    profiles: ["ui"]
    ports:
      - "3000:80"
    depends_on:
      - pedidos
      - inspector
    networks:
      - backend
    restart: unless-stopped
```

Também adicionar `ui/node_modules` e `ui/dist` ao `.dockerignore` e ao `.gitignore` da raiz (o primeiro evita que o build context da API fique enorme).

Comandos:
```bash
docker compose --profile ui up -d --build     # API + banco + UI + inspetor
# abrir http://localhost:3000
docker compose --profile ui down              # derruba tudo (mantém os dados)
```

---

## 10. README — seção a adicionar

Adicionar ao `README.md` existente uma seção **"Painel de testes (opcional)"**, sem alterar as seções já existentes. A seção deve conter:
- aviso de que é uma ferramenta extra do grupo, fora do escopo exigido, e que não sobe com o `docker compose up` padrão;
- comando de execução e URL;
- resumo das páginas;
- arquitetura (proxy nginx e inspetor read-only);
- aviso de segurança: o inspetor monta o Docker socket e por isso deve ser usado só localmente;
- observação de que os pedidos criados pelos cenários ficam no banco com o prefixo `[teste-ui]`.

---

## 11. Sequência de implementação

1. Confirmar que a API do `PLANO_DESENVOLVIMENTO.md` está pronta: `docker compose up -d --build` funciona e `docker compose --profile test run --rm tests` passa.
2. Criar o serviço `inspector` (banco read-only primeiro, depois Docker) e testá-lo com `curl` de dentro da rede (ex.: `docker compose --profile ui exec ui wget -qO- http://inspector:8001/db/info` após subir a UI, ou um container temporário na rede).
3. Criar o projeto Vite em `ui/`, configurar Tailwind, shadcn/ui, fontes e tema.
4. Implementar `lib/http.ts`, os clientes tipados e o store de histórico.
5. Implementar o layout (sidebar, topbar com indicadores).
6. Implementar as páginas na ordem: Visão geral → Console de API → Pedidos → Banco de dados → Histórico → Máquina de estados → Infraestrutura → Experimento → Cenários.
7. Escrever os testes Vitest das funções puras: `status.ts` (transições), `curl.ts`, `format.ts` e as asserções do runner.
8. Criar `ui/Dockerfile`, `nginx.conf` e adicionar os serviços no compose.
9. Atualizar o README.
10. Rodar o checklist da seção 12 e **parar**, avisando o usuário para commitar.

---

## 12. Checklist de aceite

Isolamento da entrega:
- [ ] `git diff` não mostra alterações em `app/`, `tests/`, no `Dockerfile` raiz, em `requirements*.txt` nem nos serviços `pedidos`/`postgres`/`tests` do compose.
- [ ] Após `docker compose --profile ui down`, rodar `docker compose up -d --build` sobe **apenas** `pedidos` e `postgres` (conferir com `docker compose ps`), e a API responde em `localhost:8000`.
- [ ] `docker compose --profile test run --rm tests` continua passando.

UI e inspetor:
- [ ] `docker compose --profile ui up -d --build` sobe os quatro serviços, e a UI abre em `http://localhost:3000`.
- [ ] O inspetor não tem porta publicada; o postgres continua sem porta publicada.
- [ ] `/inspector/db/info` mostra `default_transaction_read_only = on`.
- [ ] `POST /inspector/docker/containers/ui/restart` retorna 403.
- [ ] "Executar todos" na página de Cenários → **todos passam**.
- [ ] O Experimento de persistência roda do início ao fim, mostrando a queda, a volta e os dados preservados.
- [ ] Com o `pedidos` reiniciando, a UI mostra "API indisponível" (sem tela quebrada) e se recupera sozinha.
- [ ] Toasts aparecem com código e mensagem em sucesso e erro; erros 422 aparecem nos campos do formulário.
- [ ] Tema claro/escuro funciona; layout usável em janela estreita.
- [ ] O build Docker da UI roda Vitest e `tsc` sem erros.
- [ ] Simulação de máquina limpa: após o usuário commitar, clonar o repositório local em `/tmp`, rodar `docker compose --profile ui up -d --build` e repetir as verificações acima; depois, `docker compose --profile ui down -v`.

---

## 13. Fora do escopo

Autenticação na UI, escrita no banco pelo inspetor (INSERT/UPDATE/DELETE), console SQL livre, exclusão de pedidos, controle de containers além de restart/logs/status, deploy fora da máquina local.
