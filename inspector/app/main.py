"""Inspetor do painel de testes: leitura do banco e controle restrito de containers.

Ferramenta opcional (profile "ui"), independente da API de Pedidos.
"""

from typing import Literal

from fastapi import FastAPI, Query, Request, status
from fastapi.responses import JSONResponse

from app import db, docker_ctl

app = FastAPI(title="Inspetor - Painel de Testes", version="1.0.0")


def _erro(status_code: int):
    async def handler(request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=status_code, content={"detail": str(exc)})

    return handler


app.add_exception_handler(db.BancoIndisponivelError, _erro(status.HTTP_503_SERVICE_UNAVAILABLE))
app.add_exception_handler(db.TabelaNaoEncontradaError, _erro(status.HTTP_404_NOT_FOUND))
app.add_exception_handler(db.ParametroInvalidoError, _erro(status.HTTP_422_UNPROCESSABLE_CONTENT))
app.add_exception_handler(
    docker_ctl.DockerIndisponivelError, _erro(status.HTTP_503_SERVICE_UNAVAILABLE)
)
app.add_exception_handler(docker_ctl.ServicoNaoPermitidoError, _erro(status.HTTP_403_FORBIDDEN))
app.add_exception_handler(docker_ctl.ServicoNaoEncontradoError, _erro(status.HTTP_404_NOT_FOUND))


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/db/info")
def db_info():
    return db.info()


@app.get("/db/tables")
def db_tables():
    return db.tabelas()


@app.get("/db/tables/{tabela}/schema")
def db_schema(tabela: str):
    return db.schema(tabela)


@app.get("/db/tables/{tabela}/rows")
def db_rows(
    tabela: str,
    limit: int = Query(50, ge=1, le=db.MAX_LIMIT),
    offset: int = Query(0, ge=0),
    order_by: str | None = None,
    direction: Literal["asc", "desc"] = "asc",
):
    return db.linhas(tabela, limit, offset, order_by, direction)


@app.get("/docker/containers")
def docker_containers():
    return docker_ctl.listar()


@app.post("/docker/containers/{servico}/restart")
def docker_restart(servico: str):
    return docker_ctl.reiniciar(servico)


@app.get("/docker/containers/{servico}/logs")
def docker_logs(servico: str, tail: int = Query(200, ge=1, le=docker_ctl.MAX_TAIL)):
    return docker_ctl.logs(servico, tail)
