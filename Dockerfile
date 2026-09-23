FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /code

ARG INSTALL_DEV=false

# Dependências antes do código, para aproveitar o cache de camadas.
COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && if [ "$INSTALL_DEV" = "true" ]; then pip install --no-cache-dir -r requirements-dev.txt; fi

COPY app/ ./app/
COPY tests/ ./tests/
COPY pytest.ini ./

RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && chown appuser /code
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
