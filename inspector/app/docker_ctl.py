"""Status, logs e restart de containers do próprio projeto Compose.

Opera apenas em containers com o mesmo label `com.docker.compose.project`
do inspetor. Restart e logs são restritos a uma allowlist de serviços.
"""

import socket
import time
from typing import Any

import docker
from docker.errors import DockerException, NotFound
from docker.models.containers import Container

LABEL_PROJETO = "com.docker.compose.project"
LABEL_SERVICO = "com.docker.compose.service"
SERVICOS_CONTROLAVEIS = {"pedidos", "postgres"}
MAX_TAIL = 1000


class DockerIndisponivelError(Exception):
    pass


class ServicoNaoPermitidoError(Exception):
    pass


class ServicoNaoEncontradoError(Exception):
    pass


_client: docker.DockerClient | None = None
_projeto: str | None = None


def _docker() -> tuple[docker.DockerClient, str]:
    global _client, _projeto
    try:
        if _client is None:
            _client = docker.from_env()
        if _projeto is None:
            proprio = _client.containers.get(socket.gethostname())
            _projeto = proprio.labels[LABEL_PROJETO]
        return _client, _projeto
    except (DockerException, KeyError) as exc:
        _client = None
        raise DockerIndisponivelError(f"Docker indisponível: {exc}") from exc


def _containers_do_projeto() -> list[Container]:
    client, projeto = _docker()
    try:
        return client.containers.list(all=True, filters={"label": f"{LABEL_PROJETO}={projeto}"})
    except DockerException as exc:
        raise DockerIndisponivelError(f"Docker indisponível: {exc}") from exc


def _containers_do_servico(servico: str) -> list[Container]:
    if servico not in SERVICOS_CONTROLAVEIS:
        raise ServicoNaoPermitidoError(
            f"Operação não permitida no serviço '{servico}'. "
            f"Permitidos: {', '.join(sorted(SERVICOS_CONTROLAVEIS))}"
        )
    containers = [c for c in _containers_do_projeto() if c.labels.get(LABEL_SERVICO) == servico]
    if not containers:
        raise ServicoNaoEncontradoError(f"Serviço '{servico}' não encontrado no projeto")
    return sorted(containers, key=lambda c: c.name)


def _portas_publicadas(container: Container) -> list[dict[str, Any]]:
    portas = []
    vistas = set()
    for porta_container, bindings in (container.attrs["NetworkSettings"]["Ports"] or {}).items():
        for b in bindings or []:
            chave = (porta_container, b["HostPort"])
            if chave in vistas:  # IPv4 e IPv6 duplicam a mesma porta
                continue
            vistas.add(chave)
            portas.append({"container": porta_container, "host": int(b["HostPort"])})
    return portas


def _resumo(container: Container) -> dict[str, Any]:
    estado = container.attrs["State"]
    health = estado.get("Health")
    return {
        "servico": container.labels.get(LABEL_SERVICO),
        "nome": container.name,
        "estado": estado["Status"],
        "health": health["Status"] if health else None,
        "started_at": estado.get("StartedAt"),
        "imagem": container.attrs["Config"]["Image"],
        "restart_count": container.attrs.get("RestartCount", 0),
        "portas": _portas_publicadas(container),
        "controlavel": container.labels.get(LABEL_SERVICO) in SERVICOS_CONTROLAVEIS,
    }


def listar() -> list[dict[str, Any]]:
    return sorted(
        (_resumo(c) for c in _containers_do_projeto()),
        key=lambda r: (r["servico"] or "", r["nome"]),
    )


def reiniciar(servico: str) -> dict[str, Any]:
    containers = _containers_do_servico(servico)
    inicio = time.perf_counter()
    reiniciados = []
    try:
        for c in containers:
            c.restart(timeout=10)
            c.reload()
            reiniciados.append({"nome": c.name, "started_at": c.attrs["State"]["StartedAt"]})
    except NotFound as exc:
        raise ServicoNaoEncontradoError(str(exc)) from exc
    except DockerException as exc:
        raise DockerIndisponivelError(f"Falha ao reiniciar: {exc}") from exc
    return {
        "servico": servico,
        "started_at": reiniciados[0]["started_at"],
        "duracao_ms": round((time.perf_counter() - inicio) * 1000),
        "containers": reiniciados,
    }


def logs(servico: str, tail: int) -> dict[str, Any]:
    tail = max(1, min(tail, MAX_TAIL))
    container = _containers_do_servico(servico)[0]
    try:
        bruto = container.logs(tail=tail, timestamps=True).decode("utf-8", errors="replace")
    except DockerException as exc:
        raise DockerIndisponivelError(f"Falha ao ler logs: {exc}") from exc
    linhas = []
    for linha in bruto.splitlines():
        timestamp, _, mensagem = linha.partition(" ")
        linhas.append({"timestamp": timestamp, "mensagem": mensagem})
    return {"servico": servico, "container": container.name, "tail": tail, "linhas": linhas}
