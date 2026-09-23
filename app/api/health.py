from fastapi import APIRouter

from app.schemas.pedido import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Verificação leve de disponibilidade, sem acesso ao banco."""
    return HealthResponse(status="ok")
