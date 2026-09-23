"""Acesso somente leitura ao PostgreSQL.

Toda conexão é aberta com `default_transaction_read_only=on` e o código só
executa SELECT. Nomes de tabela/coluna vindos da URL são validados contra o
`information_schema` e inseridos com `sql.Identifier`, nunca concatenados.
"""

import os
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

import psycopg
from psycopg import sql
from psycopg.rows import dict_row

SCHEMA = "public"
MAX_LIMIT = 500

CONSTRAINT_TYPES = {
    "p": "PRIMARY KEY",
    "c": "CHECK",
    "f": "FOREIGN KEY",
    "u": "UNIQUE",
    "x": "EXCLUDE",
    "n": "NOT NULL",
}


class BancoIndisponivelError(Exception):
    pass


class TabelaNaoEncontradaError(Exception):
    pass


class ParametroInvalidoError(Exception):
    pass


def _database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise BancoIndisponivelError("Variável de ambiente DATABASE_URL não definida")
    return url


@contextmanager
def conectar() -> Iterator[psycopg.Connection]:
    """Abre uma conexão nova, somente leitura, e a fecha ao final."""
    try:
        conn = psycopg.connect(
            _database_url(),
            connect_timeout=3,
            options="-c default_transaction_read_only=on",
            row_factory=dict_row,
        )
    except psycopg.OperationalError as exc:
        raise BancoIndisponivelError(f"Banco de dados indisponível: {exc}") from exc
    try:
        yield conn
    finally:
        conn.close()


def _json_value(valor: Any) -> Any:
    if isinstance(valor, Decimal):
        return float(valor)
    if isinstance(valor, (datetime, date, time)):
        return valor.isoformat()
    return valor


def _tabelas(conn: psycopg.Connection) -> list[str]:
    rows = conn.execute(
        """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = %s AND table_type = 'BASE TABLE'
        ORDER BY table_name
        """,
        (SCHEMA,),
    ).fetchall()
    return [r["table_name"] for r in rows]


def _validar_tabela(conn: psycopg.Connection, tabela: str) -> None:
    if tabela not in _tabelas(conn):
        raise TabelaNaoEncontradaError(f"Tabela '{tabela}' não encontrada no schema {SCHEMA}")


def _colunas(conn: psycopg.Connection, tabela: str) -> list[dict[str, Any]]:
    return conn.execute(
        """
        SELECT column_name, data_type, character_maximum_length, numeric_precision,
               numeric_scale, is_nullable, column_default, ordinal_position
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        ORDER BY ordinal_position
        """,
        (SCHEMA, tabela),
    ).fetchall()


def _formatar_tipo(col: dict[str, Any]) -> str:
    tipo = col["data_type"]
    if col["character_maximum_length"]:
        return f"{tipo}({col['character_maximum_length']})"
    if tipo == "numeric" and col["numeric_precision"] is not None:
        return f"numeric({col['numeric_precision']},{col['numeric_scale']})"
    return tipo


def info() -> dict[str, Any]:
    with conectar() as conn:
        row = conn.execute(
            """
            SELECT current_setting('server_version') AS versao,
                   version() AS versao_completa,
                   current_database() AS banco,
                   pg_size_pretty(pg_database_size(current_database())) AS tamanho,
                   (SELECT count(*) FROM pg_stat_activity
                     WHERE datname = current_database() AND state = 'active') AS conexoes_ativas,
                   (SELECT count(*) FROM pg_stat_activity
                     WHERE datname = current_database()) AS conexoes_total,
                   current_setting('default_transaction_read_only') AS default_transaction_read_only,
                   now() AS horario_servidor
            """
        ).fetchone()
    return {k: _json_value(v) for k, v in row.items()}


def tabelas() -> list[dict[str, Any]]:
    with conectar() as conn:
        resultado = []
        for nome in _tabelas(conn):
            query = sql.SQL("SELECT count(*) AS total FROM {}").format(
                sql.Identifier(SCHEMA, nome)
            )
            total = conn.execute(query).fetchone()["total"]
            resultado.append({"nome": nome, "linhas": total})
        return resultado


def schema(tabela: str) -> dict[str, Any]:
    with conectar() as conn:
        _validar_tabela(conn, tabela)
        colunas = [
            {
                "nome": c["column_name"],
                "tipo": _formatar_tipo(c),
                "nullable": c["is_nullable"] == "YES",
                "default": c["column_default"],
                "posicao": c["ordinal_position"],
            }
            for c in _colunas(conn, tabela)
        ]
        constraints = [
            {
                "nome": r["conname"],
                "tipo": CONSTRAINT_TYPES.get(r["contype"], r["contype"]),
                "definicao": r["definicao"],
            }
            for r in conn.execute(
                """
                SELECT con.conname, con.contype, pg_get_constraintdef(con.oid) AS definicao
                FROM pg_constraint con
                JOIN pg_class rel ON rel.oid = con.conrelid
                JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
                WHERE nsp.nspname = %s AND rel.relname = %s
                ORDER BY con.contype DESC, con.conname
                """,
                (SCHEMA, tabela),
            ).fetchall()
        ]
        indices = [
            {"nome": r["indexname"], "definicao": r["indexdef"]}
            for r in conn.execute(
                """
                SELECT indexname, indexdef FROM pg_indexes
                WHERE schemaname = %s AND tablename = %s
                ORDER BY indexname
                """,
                (SCHEMA, tabela),
            ).fetchall()
        ]
    return {"tabela": tabela, "colunas": colunas, "constraints": constraints, "indices": indices}


def linhas(
    tabela: str, limit: int, offset: int, order_by: str | None, direction: str
) -> dict[str, Any]:
    if not 1 <= limit <= MAX_LIMIT:
        raise ParametroInvalidoError(f"limit deve estar entre 1 e {MAX_LIMIT}")
    if offset < 0:
        raise ParametroInvalidoError("offset não pode ser negativo")
    if direction not in ("asc", "desc"):
        raise ParametroInvalidoError("direction deve ser 'asc' ou 'desc'")

    with conectar() as conn:
        _validar_tabela(conn, tabela)
        colunas = [c["column_name"] for c in _colunas(conn, tabela)]
        if order_by is None:
            order_by = "id" if "id" in colunas else colunas[0]
        if order_by not in colunas:
            raise ParametroInvalidoError(f"Coluna '{order_by}' não existe na tabela '{tabela}'")

        tabela_id = sql.Identifier(SCHEMA, tabela)
        total = conn.execute(
            sql.SQL("SELECT count(*) AS total FROM {}").format(tabela_id)
        ).fetchone()["total"]
        query = sql.SQL("SELECT * FROM {} ORDER BY {} {} LIMIT %s OFFSET %s").format(
            tabela_id,
            sql.Identifier(order_by),
            sql.SQL("ASC" if direction == "asc" else "DESC"),
        )
        rows = conn.execute(query, (limit, offset)).fetchall()

    return {
        "columns": colunas,
        "rows": [{k: _json_value(v) for k, v in r.items()} for r in rows],
        "total": total,
    }
