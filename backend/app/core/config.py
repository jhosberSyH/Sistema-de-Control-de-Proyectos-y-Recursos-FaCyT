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


settings = Settings()

