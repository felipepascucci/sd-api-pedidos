from typing import Annotated

from fastapi import APIRouter, Depends, Path, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.pedido_repository import PedidoRepository
from app.schemas.pedido import PedidoCreate, PedidoResponse, StatusUpdate
from app.services.pedido_service import PedidoService

router = APIRouter(prefix="/pedidos", tags=["pedidos"])

# O id é INTEGER no banco: fora desse intervalo responde 422 em vez de estourar na query.
PedidoId = Annotated[int, Path(ge=1, le=2_147_483_647)]


def get_pedido_service(db: Session = Depends(get_db)) -> PedidoService:
    return PedidoService(PedidoRepository(db))


@router.post("", response_model=PedidoResponse, status_code=status.HTTP_201_CREATED)
def criar_pedido(
    dados: PedidoCreate,
    response: Response,
    service: PedidoService = Depends(get_pedido_service),
):
    pedido = service.criar(
        cliente=dados.cliente,
        produto=dados.produto,
        quantidade=dados.quantidade,
        valor_unitario=dados.valor_unitario,
    )
    response.headers["Location"] = f"/pedidos/{pedido.id}"
    return pedido


@router.get("", response_model=list[PedidoResponse])
def listar_pedidos(service: PedidoService = Depends(get_pedido_service)):
    return service.listar()


@router.get("/{pedido_id}", response_model=PedidoResponse)
def consultar_pedido(pedido_id: PedidoId, service: PedidoService = Depends(get_pedido_service)):
    return service.consultar(pedido_id)


@router.patch("/{pedido_id}/status", response_model=PedidoResponse)
def alterar_status(
    pedido_id: PedidoId,
    dados: StatusUpdate,
    service: PedidoService = Depends(get_pedido_service),
):
    return service.alterar_status(pedido_id, dados.status)
