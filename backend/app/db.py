"""Acces PostgreSQL — base « cavally ».

Trois tables y vivent : `clients`, `admins` et `repetiteur`. Les demandes de
devis ne sont volontairement PAS persistees : le document est relaye vers
WhatsApp puis ecarte.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings

logger = logging.getLogger("cavally.db")


class Base(DeclarativeBase):
    """Base declarative commune aux modeles."""


_settings = get_settings()

engine = create_engine(
    _settings.database_url,
    pool_pre_ping=True,  # une connexion coupee est renouvelee au lieu d'echouer
    future=True,
)

SessionLocale = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """Dependance FastAPI : une session par requete, refermee a la fin."""
    session = SessionLocale()
    try:
        yield session
    finally:
        session.close()


def initialiser_base() -> bool:
    """Cree les tables manquantes. Renvoie True si la base repond.

    L'echec n'interrompt pas le demarrage : l'outil interne (extraction Gemini
    et generation Excel) ne depend pas de la base et doit rester utilisable.
    """
    from . import models  # noqa: F401  — enregistre les modeles sur Base.metadata

    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:
        logger.error(
            "Base « cavally » injoignable : %s — l'espace clients sera indisponible "
            "(verifie DATABASE_URL dans backend/.env)",
            exc,
        )
        return False

    logger.info("Base « cavally » prete (clients, admins, repetiteur)")
    return True


def base_disponible() -> bool:
    """Test de connexion a la volee, pour le point de sante."""
    try:
        with engine.connect() as connexion:
            connexion.exec_driver_sql("SELECT 1")
        return True
    except Exception:
        return False
