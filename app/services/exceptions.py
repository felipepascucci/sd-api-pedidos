"""Exceções de domínio. Não conhecem HTTP: a camada API as traduz."""

from app.models.pedido import StatusPedido


class PedidoNaoEncontradoError(Exception):
    def __init__(self, pedido_id: int) -> None:
        self.pedido_id = pedido_id
        super().__init__(f"Pedido {pedido_id} não encontrado")


class TransicaoStatusInvalidaError(Exception):
    def __init__(self, status_atual: StatusPedido, novo_status: StatusPedido) -> None:
        self.status_atual = status_atual
        self.novo_status = novo_status
        super().__init__(
            f"Transição de status inválida: {status_atual.value} -> {novo_status.value}"
        )
