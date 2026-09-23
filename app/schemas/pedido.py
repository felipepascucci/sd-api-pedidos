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


# Limites garantem que nada estoure as colunas do banco: quantidade cabe em
# INTEGER e o valor_total máximo (1.000.000 x 999.999,99) cabe em NUMERIC(14,2).
QUANTIDADE_MAXIMA = 1_000_000
VALOR_UNITARIO_MAXIMO = Decimal("999999.99")


class PedidoCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cliente: TextoObrigatorio
    produto: TextoObrigatorio
    quantidade: StrictInt = Field(gt=0, le=QUANTIDADE_MAXIMA)
    valor_unitario: Decimal = Field(
        gt=0, le=VALOR_UNITARIO_MAXIMO, max_digits=8, decimal_places=2
    )


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
