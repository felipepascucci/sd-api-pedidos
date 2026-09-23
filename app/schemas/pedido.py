from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, StrictInt, StringConstraints

from app.models.pedido import StatusPedido

TextoObrigatorio = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
]

# Dinheiro é Decimal internamente, mas sai no JSON como número (ex.: 59.9).
DecimalComoNumero = Annotated[
    Decimal, PlainSerializer(float, return_type=float, when_used="json")
]


class PedidoCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cliente: TextoObrigatorio
    produto: TextoObrigatorio
    quantidade: StrictInt = Field(gt=0)
    valor_unitario: Decimal = Field(gt=0, max_digits=12, decimal_places=2)


class StatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: StatusPedido


class PedidoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    cliente: str
    produto: str
    quantidade: int
    valor_unitario: DecimalComoNumero
    valor_total: DecimalComoNumero
    status: StatusPedido
    data_criacao: datetime


class HealthResponse(BaseModel):
    status: str = "ok"
