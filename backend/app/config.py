"""Configuration applicative — tout vient de l'environnement / du fichier .env."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
DEFAULT_DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/cavally"


@dataclass(frozen=True)
class ParametresWhatsApp:
    """Relais WhatsApp. Sans jeton ni destinataire, l'envoi est simule."""

    token: str
    phone_number_id: str
    destinataire: str
    api_version: str
    api_url: str

    @property
    def configure(self) -> bool:
        return bool(self.token and self.phone_number_id and self.destinataire)


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str
    gemini_model: str
    max_upload_bytes: int
    database_url: str
    jwt_secret: str
    jwt_algorithme: str
    session_duree_heures: int
    cookie_securise: bool
    whatsapp: ParametresWhatsApp
    cors_origins: list[str] = field(default_factory=list)

    @property
    def max_upload_mb(self) -> int:
        return self.max_upload_bytes // (1024 * 1024)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    max_mb = int(os.getenv("MAX_UPLOAD_MB", "18") or 18)
    origins = [o.strip() for o in os.getenv("CORS_ORIGINS", DEFAULT_ORIGINS).split(",") if o.strip()]

    return Settings(
        # — Outil interne (extraction Gemini + Excel) —
        gemini_api_key=os.getenv("GEMINI_API_KEY", "").strip(),
        # Alias « latest » : suit le Flash courant, resiste au retrait d'une version datee.
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-flash-latest").strip() or "gemini-flash-latest",
        max_upload_bytes=max_mb * 1024 * 1024,
        # — Espace clients —
        database_url=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL).strip() or DEFAULT_DATABASE_URL,
        jwt_secret=os.getenv("JWT_SECRET", "").strip(),
        jwt_algorithme=os.getenv("JWT_ALGORITHME", "HS256").strip() or "HS256",
        session_duree_heures=int(os.getenv("SESSION_DUREE_HEURES", "12") or 12),
        # Cookie `Secure` : a activer des que le site est servi en HTTPS.
        cookie_securise=os.getenv("COOKIE_SECURISE", "false").strip().lower() in {"1", "true", "yes"},
        whatsapp=ParametresWhatsApp(
            token=os.getenv("WHATSAPP_TOKEN", "").strip(),
            phone_number_id=os.getenv("WHATSAPP_PHONE_NUMBER_ID", "").strip(),
            destinataire=os.getenv("WHATSAPP_DESTINATAIRE", "").strip(),
            api_version=os.getenv("WHATSAPP_API_VERSION", "v21.0").strip() or "v21.0",
            api_url=os.getenv("WHATSAPP_API_URL", "https://graph.facebook.com").strip()
            or "https://graph.facebook.com",
        ),
        cors_origins=origins,
    )
