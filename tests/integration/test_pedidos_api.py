from fastapi.testclient import TestClient
import pytest

from app.main import app
from app.models.pedido import Pedido

PEDIDO_VALIDO = {
    "cliente": "Maria Silva",
    "produto": "Teclado",
    "quantidade": 2,
    "valor_unitario": 149.90,
}


def criar(client: TestClient, **overrides) -> dict:
    resp = client.post("/pedidos", json={**PEDIDO_VALIDO, **overrides})
    assert resp.status_code == 201, resp.text
    return resp.json()


def patch_status(client: TestClient, pedido_id: int, status: str):
    return client.patch(f"/pedidos/{pedido_id}/status", json={"status": status})


# --- health ---------------------------------------------------------------


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


# --- POST /pedidos --------------------------------------------------------


def test_criar_pedido(client):
    resp = client.post("/pedidos", json=PEDIDO_VALIDO)
    assert resp.status_code == 201
    corpo = resp.json()
    assert resp.headers["Location"] == f"/pedidos/{corpo['id']}"
    assert corpo["valor_total"] == 299.8
    assert corpo["valor_unitario"] == 149.9
    assert corpo["status"] == "CRIADO"
    assert isinstance(corpo["id"], int)
    assert corpo["data_criacao"]
    assert corpo["cliente"] == "Maria Silva"


def test_criar_nos_limites_maximos(client):
    # 1.000.000 x 999.999,99 é o maior valor_total possível e precisa caber em NUMERIC(14,2).
    corpo = criar(client, quantidade=1_000_000, valor_unitario=999999.99)
    assert corpo["valor_total"] == 999999990000.0


def test_criar_remove_espacos_nas_pontas(client):
    corpo = criar(client, cliente="  Maria  ")
    assert corpo["cliente"] == "Maria"


@pytest.mark.parametrize(
    "payload",
    [
        {k: v for k, v in PEDIDO_VALIDO.items() if k != "cliente"},
        {k: v for k, v in PEDIDO_VALIDO.items() if k != "quantidade"},
        {**PEDIDO_VALIDO, "quantidade": 0},
        {**PEDIDO_VALIDO, "quantidade": -1},
        {**PEDIDO_VALIDO, "quantidade": "5"},
        {**PEDIDO_VALIDO, "quantidade": 5.5},
        {**PEDIDO_VALIDO, "valor_unitario": 0},
        {**PEDIDO_VALIDO, "valor_unitario": 1.001},
        {**PEDIDO_VALIDO, "cliente": ""},
        {**PEDIDO_VALIDO, "cliente": "   "},
        {**PEDIDO_VALIDO, "valor_total": 10},
        {**PEDIDO_VALIDO, "status": "CONFIRMADO"},
        {**PEDIDO_VALIDO, "quantidade": 1_000_001},
        {**PEDIDO_VALIDO, "quantidade": 2_147_483_648},
        {**PEDIDO_VALIDO, "valor_unitario": 1_000_000},
        {**PEDIDO_VALIDO, "quantidade": 1000, "valor_unitario": 9999999999.99},
    ],
    ids=[
        "sem-cliente",
        "sem-quantidade",
        "quantidade-zero",
        "quantidade-negativa",
        "quantidade-string",
        "quantidade-float",
        "valor-zero",
        "valor-3-casas",
        "cliente-vazio",
        "cliente-espacos",
        "extra-valor_total",
        "extra-status",
        "quantidade-acima-do-limite",
        "quantidade-estoura-integer",
        "valor-acima-do-limite",
        "total-estouraria-coluna",
    ],
)
def test_criar_invalido_422(client, payload):
    resp = client.post("/pedidos", json=payload)
    assert resp.status_code == 422
    assert client.get("/pedidos").json() == []


# --- GET /pedidos/{id} ----------------------------------------------------


def test_consultar_pedido(client):
    criado = criar(client)
    resp = client.get(f"/pedidos/{criado['id']}")
    assert resp.status_code == 200
    assert resp.json() == criado


def test_consultar_inexistente_404(client):
    resp = client.get("/pedidos/999")
    assert resp.status_code == 404
    assert resp.json() == {"detail": "Pedido 999 não encontrado"}


def test_consultar_id_nao_numerico_422(client):
    assert client.get("/pedidos/abc").status_code == 422


@pytest.mark.parametrize("pedido_id", [99999999999, 2_147_483_648, 0, -1])
def test_consultar_id_fora_do_intervalo_422(client, pedido_id):
    assert client.get(f"/pedidos/{pedido_id}").status_code == 422


# --- GET /pedidos ---------------------------------------------------------


def test_listar_vazio(client):
    resp = client.get("/pedidos")
    assert resp.status_code == 200
    assert resp.json() == []


def test_listar_em_ordem(client):
    p1 = criar(client, produto="Teclado")
    p2 = criar(client, produto="Mouse")
    lista = client.get("/pedidos").json()
    assert [p["id"] for p in lista] == [p1["id"], p2["id"]]
    assert p1["id"] < p2["id"]


# --- PATCH /pedidos/{id}/status -------------------------------------------


@pytest.mark.parametrize(
    "caminho",
    [["CONFIRMADO"], ["CANCELADO"], ["CONFIRMADO", "CANCELADO"]],
    ids=["criado-confirmado", "criado-cancelado", "confirmado-cancelado"],
)
def test_transicoes_validas_200(client, caminho):
    criado = criar(client)
    for status in caminho:
        resp = patch_status(client, criado["id"], status)
        assert resp.status_code == 200
        assert resp.json()["status"] == status
    corpo = resp.json()
    for campo in ("id", "cliente", "produto", "quantidade", "valor_unitario", "valor_total", "data_criacao"):
        assert corpo[campo] == criado[campo]


@pytest.mark.parametrize(
    ("preparo", "novo", "atual"),
    [
        ([], "CRIADO", "CRIADO"),
        (["CONFIRMADO"], "CONFIRMADO", "CONFIRMADO"),
        (["CONFIRMADO"], "CRIADO", "CONFIRMADO"),
        (["CANCELADO"], "CONFIRMADO", "CANCELADO"),
        (["CANCELADO"], "CRIADO", "CANCELADO"),
    ],
)
def test_transicoes_invalidas_409(client, preparo, novo, atual):
    criado = criar(client)
    for status in preparo:
        assert patch_status(client, criado["id"], status).status_code == 200
    resp = patch_status(client, criado["id"], novo)
    assert resp.status_code == 409
    assert resp.json() == {"detail": f"Transição de status inválida: {atual} -> {novo}"}
    assert client.get(f"/pedidos/{criado['id']}").json()["status"] == atual


def test_alterar_status_inexistente_404(client):
    assert patch_status(client, 999, "CONFIRMADO").status_code == 404


@pytest.mark.parametrize("pedido_id", [99999999999, 0])
def test_alterar_status_id_fora_do_intervalo_422(client, pedido_id):
    assert patch_status(client, pedido_id, "CONFIRMADO").status_code == 422


@pytest.mark.parametrize(
    "payload",
    [{"status": "ENTREGUE"}, {}, {"status": "CONFIRMADO", "cliente": "Outro"}],
    ids=["fora-do-enum", "sem-status", "campo-extra"],
)
def test_alterar_status_corpo_invalido_422(client, payload):
    criado = criar(client)
    resp = client.patch(f"/pedidos/{criado['id']}/status", json=payload)
    assert resp.status_code == 422


# --- persistência ---------------------------------------------------------


def test_pedido_persiste_no_banco(client, TestSessionLocal):
    criado = criar(client)

    # Nova sessão, independente da usada na requisição.
    with TestSessionLocal() as db:
        pedido = db.get(Pedido, criado["id"])
        assert pedido is not None
        assert pedido.cliente == "Maria Silva"

    # Novo cliente (novo ciclo de lifespan da aplicação).
    with TestClient(app) as outro_client:
        resp = outro_client.get(f"/pedidos/{criado['id']}")
        assert resp.status_code == 200
        assert resp.json() == criado
