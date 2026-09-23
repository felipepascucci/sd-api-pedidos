"""Fixtures compartilhadas.

Os testes de integração usam o banco separado `pedidos_test`, criado aqui
automaticamente (sem depender de scripts de inicialização do volume).
Os testes unitários não usam nenhuma destas fixtures e não tocam no banco.
"""

import os
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models import pedido  # noqa: F401  (registra o modelo no Base.metadata)


def _env(nome: str) -> str:
    valor = os.environ.get(nome)
    if not valor:
        pytest.fail(f"Variável de ambiente {nome} não definida")
    return valor


@pytest.fixture(scope="session")
def test_engine() -> Iterator[Engine]:
    test_url = _env("TEST_DATABASE_URL")
    nome_banco = make_url(test_url).database

    admin_engine = create_engine(_env("ADMIN_DATABASE_URL"), isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as conn:
        existe = conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :nome"), {"nome": nome_banco}
        )
        if not existe:
            conn.execute(text(f'CREATE DATABASE "{nome_banco}"'))
    admin_engine.dispose()

    engine = create_engine(test_url, pool_pre_ping=True)
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()


@pytest.fixture(scope="session")
def TestSessionLocal(test_engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=test_engine, autoflush=False, expire_on_commit=False)


@pytest.fixture
def limpar_banco(test_engine: Engine) -> None:
    with test_engine.begin() as conn:
        conn.execute(text("TRUNCATE pedidos RESTART IDENTITY"))


@pytest.fixture
def client(TestSessionLocal: sessionmaker[Session], limpar_banco: None) -> Iterator[TestClient]:
    def override_get_db() -> Iterator[Session]:
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
