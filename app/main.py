import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.api import health, pedidos
from app.database import Base, engine, wait_for_db
from app.services.exceptions import PedidoNaoEncontradoError, TransicaoStatusInvalidaError

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    wait_for_db()
    from app.models import pedido  # noqa: F401  (registra o modelo no Base.metadata)

    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="API de Pedidos", version="1.0.0", lifespan=lifespan)

app.include_router(pedidos.router)
app.include_router(health.router)


@app.exception_handler(PedidoNaoEncontradoError)
async def pedido_nao_encontrado_handler(request: Request, exc: PedidoNaoEncontradoError):
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": str(exc)})


@app.exception_handler(TransicaoStatusInvalidaError)
async def transicao_invalida_handler(request: Request, exc: TransicaoStatusInvalidaError):
    return JSONResponse(status_code=status.HTTP_409_CONFLICT, content={"detail": str(exc)})
