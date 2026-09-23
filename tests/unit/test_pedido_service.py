from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.models.pedido import Pedido, StatusPedido
from app.services.exceptions import PedidoNaoEncontradoError, TransicaoStatusInvalidaError
from app.services.pedido_service import PedidoService


class FakePedidoRepository:
    """Repositório em memória com a mesma interface do PedidoRepository."""

    def __init__(self) -> None:
        self.pedidos: dict[int, Pedido] = {}
        self._proximo_id = 1

    def criar(self, pedido: Pedido) -> Pedido:
        pedido.id = self._proximo_id
        pedido.data_criacao = datetime.now(timezone.utc)
        self.pedidos[pedido.id] = pedido
        self._proximo_id += 1
        return pedido

    def buscar_por_id(self, pedido_id: int) -> Pedido | None:
        return self.pedidos.get(pedido_id)

    def listar(self) -> list[Pedido]:
        return [self.pedidos[i] for i in sorted(self.pedidos)]

    def atualizar_status(self, pedido: Pedido, novo_status: StatusPedido) -> Pedido:
        pedido.status = novo_status
        return pedido


@pytest.fixture
def service() -> PedidoService:
    return PedidoService(FakePedidoRepository())


def criar_pedido(service: PedidoService, quantidade: int = 2, valor: str = "149.90") -> Pedido:
    return service.criar("Maria", "Teclado", quantidade, Decimal(valor))


def criar_com_status(service: PedidoService, status: StatusPedido) -> Pedido:
    pedido = criar_pedido(service)
    if status != StatusPedido.CRIADO:
        service.alterar_status(pedido.id, status)
    return pedido


def test_calcula_valor_total(service):
    pedido = criar_pedido(service, quantidade=2, valor="149.90")
    assert pedido.valor_total == Decimal("299.80")


def test_valor_total_arredonda_half_up(service):
    pedido = criar_pedido(service, quantidade=3, valor="0.335")
    # 3 x 0.335 = 1.005 -> 1.01 (ROUND_HALF_UP)
    assert pedido.valor_total == Decimal("1.01")


def test_status_inicial_criado(service):
    pedido = criar_pedido(service)
    assert pedido.status == StatusPedido.CRIADO
    assert pedido.id is not None


def test_consultar_existente(service):
    pedido = criar_pedido(service)
    assert service.consultar(pedido.id) is pedido


def test_consultar_inexistente(service):
    with pytest.raises(PedidoNaoEncontradoError):
        service.consultar(999)


def test_listar_em_ordem_de_id(service):
    p1 = criar_pedido(service)
    p2 = criar_pedido(service)
    assert [p.id for p in service.listar()] == [p1.id, p2.id]


@pytest.mark.parametrize(
    ("de", "para"),
    [
        (StatusPedido.CRIADO, StatusPedido.CONFIRMADO),
        (StatusPedido.CRIADO, StatusPedido.CANCELADO),
        (StatusPedido.CONFIRMADO, StatusPedido.CANCELADO),
    ],
)
def test_transicoes_permitidas(service, de, para):
    pedido = criar_com_status(service, de)
    atualizado = service.alterar_status(pedido.id, para)
    assert atualizado.status == para


@pytest.mark.parametrize(
    ("de", "para"),
    [
        (StatusPedido.CANCELADO, StatusPedido.CRIADO),
        (StatusPedido.CANCELADO, StatusPedido.CONFIRMADO),
        (StatusPedido.CANCELADO, StatusPedido.CANCELADO),
        (StatusPedido.CONFIRMADO, StatusPedido.CRIADO),
        (StatusPedido.CONFIRMADO, StatusPedido.CONFIRMADO),
        (StatusPedido.CRIADO, StatusPedido.CRIADO),
    ],
)
def test_transicoes_invalidas(service, de, para):
    pedido = criar_com_status(service, de)
    with pytest.raises(TransicaoStatusInvalidaError):
        service.alterar_status(pedido.id, para)
    assert pedido.status == de


def test_alterar_status_inexistente(service):
    with pytest.raises(PedidoNaoEncontradoError):
        service.alterar_status(999, StatusPedido.CONFIRMADO)


def test_alterar_status_nao_modifica_demais_campos(service):
    pedido = criar_pedido(service)
    antes = {
        "id": pedido.id,
        "cliente": pedido.cliente,
        "produto": pedido.produto,
        "quantidade": pedido.quantidade,
        "valor_unitario": pedido.valor_unitario,
        "valor_total": pedido.valor_total,
        "data_criacao": pedido.data_criacao,
    }
    atualizado = service.alterar_status(pedido.id, StatusPedido.CONFIRMADO)
    for campo, valor in antes.items():
        assert getattr(atualizado, campo) == valor
