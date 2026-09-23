from decimal import ROUND_HALF_UP, Decimal
from typing import Protocol

from app.models.pedido import Pedido, StatusPedido
from app.services.exceptions import PedidoNaoEncontradoError, TransicaoStatusInvalidaError

TRANSICOES_PERMITIDAS: dict[StatusPedido, set[StatusPedido]] = {
    StatusPedido.CRIADO: {StatusPedido.CONFIRMADO, StatusPedido.CANCELADO},
    StatusPedido.CONFIRMADO: {StatusPedido.CANCELADO},
    StatusPedido.CANCELADO: set(),
}


class PedidoRepositoryProtocol(Protocol):
    def criar(self, pedido: Pedido) -> Pedido: ...
    def buscar_por_id(self, pedido_id: int) -> Pedido | None: ...
    def listar(self) -> list[Pedido]: ...
    def atualizar_status(self, pedido: Pedido, novo_status: StatusPedido) -> Pedido: ...


class PedidoService:
    """Regras de negócio de pedidos. Não conhece HTTP nem monta queries."""

    def __init__(self, repository: PedidoRepositoryProtocol) -> None:
        self.repository = repository

    def criar(
        self, cliente: str, produto: str, quantidade: int, valor_unitario: Decimal
    ) -> Pedido:
        valor_total = (quantidade * valor_unitario).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        pedido = Pedido(
            cliente=cliente,
            produto=produto,
            quantidade=quantidade,
            valor_unitario=valor_unitario,
            valor_total=valor_total,
            status=StatusPedido.CRIADO,
        )
        return self.repository.criar(pedido)

    def consultar(self, pedido_id: int) -> Pedido:
        pedido = self.repository.buscar_por_id(pedido_id)
        if pedido is None:
            raise PedidoNaoEncontradoError(pedido_id)
        return pedido

    def listar(self) -> list[Pedido]:
        return self.repository.listar()

    def alterar_status(self, pedido_id: int, novo_status: StatusPedido) -> Pedido:
        pedido = self.consultar(pedido_id)
        if novo_status not in TRANSICOES_PERMITIDAS.get(pedido.status, set()):
            raise TransicaoStatusInvalidaError(pedido.status, novo_status)
        return self.repository.atualizar_status(pedido, novo_status)
