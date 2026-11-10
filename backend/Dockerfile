# Servicio "api": FastAPI + Uvicorn. Misma versión de Python que las pruebas (backend/.venv).
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    API_HOST=:: \
    API_PORT=8000 \
    FORWARDED_ALLOW_IPS=*

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app

# Sin privilegios de root; var/ guarda las cotizaciones cuando STORAGE_BACKEND=local
RUN useradd --create-home --uid 10001 api && mkdir -p var/archivos && chown -R api:api /app
USER api

EXPOSE 8000

# Railway pide escuchar en "::" (su red privada es IPv6), pero con --host :: Python abre un socket solo IPv6
# y deja fuera el IPv4 de Docker y de los healthchecks. Con --host "" Uvicorn abre los dos (IPv4 e IPv6).
# El puerto es PORT si la plataforma lo define; si no, API_PORT. --proxy-headers toma la IP de X-Forwarded-For.
CMD ["sh", "-c", "host=\"$API_HOST\"; [ \"$host\" = \"::\" ] && host=\"\"; exec uvicorn app.main:app --host \"$host\" --port \"${PORT:-$API_PORT}\" --proxy-headers --forwarded-allow-ips \"$FORWARDED_ALLOW_IPS\""]
