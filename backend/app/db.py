"""Acces PostgreSQL — base « cavally ».

Trois tables y vivent : `clients`, `admins` et `repetiteurs`. Les demandes de
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


def _ajuster_schema() -> None:
    """Rattrape les tables deja creees par une version anterieure.

    `create_all` cree ce qui manque mais ne **modifie** jamais l'existant :
    sans cela, une base deja en service garderait l'ancien schema. Faute
    d'Alembic sur ce projet, ces quelques instructions tiennent lieu de
    migration. Toutes sont **idempotentes** : les rejouer ne coute rien.
    """
    from sqlalchemy import inspect, text

    inspecteur = inspect(engine)
    tables = set(inspecteur.get_table_names())

    with engine.begin() as connexion:
        # `repetiteur` -> `repetiteurs` : on renomme plutot que de recreer,
        # pour ne pas perdre les profils deja enregistres.
        if "repetiteur" in tables and "repetiteurs" not in tables:
            connexion.execute(text("ALTER TABLE repetiteur RENAME TO repetiteurs"))
            # PostgreSQL ne renomme pas les index avec la table : sans cela,
            # une base migree et une base neuve n'auraient pas le meme nom.
            connexion.execute(
                text("ALTER INDEX IF EXISTS ix_repetiteur_client_id RENAME TO ix_repetiteurs_client_id")
            )
            logger.info("Table « repetiteur » renommee en « repetiteurs »")

        if "clients" in tables:
            # Arrivee de la connexion Google : un tel compte n'a ni mot de
            # passe local, ni numero de telephone.
            connexion.execute(
                text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_sub VARCHAR(64)")
            )
            connexion.execute(
                text("CREATE UNIQUE INDEX IF NOT EXISTS ix_clients_google_sub ON clients (google_sub)")
            )
            connexion.execute(text("ALTER TABLE clients ALTER COLUMN contact DROP NOT NULL"))
            connexion.execute(text("ALTER TABLE clients ALTER COLUMN mot_de_passe_hash DROP NOT NULL"))


def initialiser_base() -> bool:
    """Cree les tables manquantes et ajuste l'existant. True si la base repond.

    L'echec n'interrompt pas le demarrage : l'outil interne (extraction Gemini
    et generation Excel) ne depend pas de la base et doit rester utilisable.
    """
    from . import models  # noqa: F401  — enregistre les modeles sur Base.metadata

    try:
        # Le renommage passe AVANT `create_all`, sinon celui-ci creerait une
        # table « repetiteurs » vide a cote de l'ancienne.
        _ajuster_schema()
        Base.metadata.create_all(bind=engine)
    except Exception as exc:
        logger.error(
            "Base « cavally » injoignable : %s — l'espace clients sera indisponible "
            "(verifie DATABASE_URL dans backend/.env)",
            exc,
        )
        return False

    logger.info("Base « cavally » prete (clients, admins, repetiteurs)")
    return True


def base_disponible() -> bool:
    """Test de connexion a la volee, pour le point de sante."""
    try:
        with engine.connect() as connexion:
            connexion.exec_driver_sql("SELECT 1")
        return True
    except Exception:
        return False
