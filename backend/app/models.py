"""Modeles persistes.

Deux tables, et deux seulement :
- `clients` : les comptes de l'espace externe ;
- `admins`  : les comptes de l'equipe, qui seuls ouvrent l'outil interne.

Les demandes de devis ne sont pas stockees — le document part vers WhatsApp
et n'est pas conserve.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Client(Base):
    """Un compte de l'espace clients externe."""

    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(primary_key=True)
    nom_complet: Mapped[str] = mapped_column(String(120), nullable=False)
    contact: Mapped[str] = mapped_column(String(32), nullable=False)
    # Stocke en minuscules : sert d'identifiant de connexion.
    email: Mapped[str] = mapped_column(String(190), nullable=False, unique=True, index=True)
    # Facultatif : vide pour un particulier.
    etablissement: Mapped[str | None] = mapped_column(String(160), nullable=True)
    mot_de_passe_hash: Mapped[str] = mapped_column(String(120), nullable=False)
    cree_le: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=lambda: datetime.now(timezone.utc)
    )

    def __repr__(self) -> str:  # pragma: no cover - confort de debogage
        return f"<Client {self.id} {self.email}>"


class Admin(Base):
    """Un compte de l'equipe Cavally, seul habilite a ouvrir l'outil interne.

    Aucune inscription publique : les comptes sont crees en ligne de commande
    (`python -m app.creer_admin`).
    """

    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Identifiant de connexion, stocke en minuscules.
    email: Mapped[str] = mapped_column(String(190), nullable=False, unique=True, index=True)
    nom: Mapped[str] = mapped_column(String(120), nullable=False)
    mot_de_passe_hash: Mapped[str] = mapped_column(String(120), nullable=False)
    cree_le: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=lambda: datetime.now(timezone.utc)
    )
    derniere_connexion: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - confort de debogage
        return f"<Admin {self.id} {self.email}>"
