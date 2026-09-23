"""Leitura da configuração a partir de variáveis de ambiente.

Nenhum endereço, porta, usuário ou senha do banco fica fixo no código:
a aplicação conhece apenas a URL de conexão recebida do ambiente.
"""

import os


def _get_database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("Variável de ambiente DATABASE_URL não definida")
    return url


DATABASE_URL: str = _get_database_url()
DB_CONNECT_RETRIES: int = int(os.environ.get("DB_CONNECT_RETRIES", "30"))
DB_CONNECT_INTERVAL: float = float(os.environ.get("DB_CONNECT_INTERVAL", "2"))
