import logging
import time
from collections.abc import Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import DATABASE_URL, DB_CONNECT_INTERVAL, DB_CONNECT_RETRIES

logger = logging.getLogger(__name__)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    """Fornece uma sessão por requisição e garante seu fechamento."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def wait_for_db(
    retries: int = DB_CONNECT_RETRIES, interval: float = DB_CONNECT_INTERVAL
) -> None:
    """Aguarda o banco aceitar conexões executando `SELECT 1` em loop."""
    for tentativa in range(1, retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("Banco de dados disponível (tentativa %d/%d)", tentativa, retries)
            return
        except OperationalError as exc:
            logger.warning(
                "Banco indisponível (tentativa %d/%d): %s", tentativa, retries, exc.orig
            )
            if tentativa < retries:
                time.sleep(interval)
    raise RuntimeError(f"Não foi possível conectar ao banco após {retries} tentativas")
