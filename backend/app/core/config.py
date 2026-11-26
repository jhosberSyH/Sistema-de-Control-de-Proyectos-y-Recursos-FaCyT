"""Application configuration settings."""

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for application runtime."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    APP_ENV: str = "development"
    APP_NAME: str = "Sistema de Control de Proyectos y Recursos FaCyT"
    APP_TIMEZONE: str = "America/Caracas"
    API_PREFIX: str = "/api"

    # Database configuration
    # Default to local SQLite file for immediate local tests/development if PostgreSQL is not active
    DATABASE_URL: str = "sqlite:///./local_dev.db"

    # Host & Port
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    FORWARDED_ALLOW_IPS: str = "*"

    # Session & Security
    SESSION_COOKIE_NAME: str = "__Host-sesion"
    SESSION_IDLE_MINUTES: int = 30
    SESSION_ABSOLUTE_HOURS: int = 8
    ALLOWED_ORIGINS: List[str] = ["http://localhost:8080", "http://localhost:5173"]

    # Inicio de sesión: límite de intentos fallidos por correo y verificaciones de contraseña simultáneas.
    # argon2id usa 64 MB por verificación: el tope de simultáneas acota la memoria ante una ráfaga.
    LOGIN_MAX_FALLOS: int = 5
    LOGIN_VENTANA_MINUTOS: int = 15
    LOGIN_VERIFICACIONES_SIMULTANEAS: int = 2

    # Saltos de proxy de confianza que agregan su entrada al final de X-Forwarded-For. La IP del cliente
    # es la entrada número PROXIES_CONFIABLES contando desde la derecha; lo que esté más a la izquierda lo
    # escribió el cliente y no se cree. 0 = ignorar X-Forwarded-For y usar la conexión directa.
    PROXIES_CONFIABLES: int = 1

    # Archivos (decisión 7): cotizaciones de gastos
    STORAGE_BACKEND: str = "local"  # local | supabase
    STORAGE_LOCAL_DIR: str = "./var/archivos"
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_STORAGE_BUCKET: str = "cotizaciones"
    MAX_COTIZACION_MB: int = 10


settings = Settings()

