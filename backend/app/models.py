"""Modeles persistes.

Trois tables :
- `clients`    : les comptes de l'espace externe ;
- `admins`     : les comptes de l'equipe, qui seuls ouvrent l'outil interne ;
- `repetiteur` : le profil d'encadrement d'un client, avec la reference de son CV.

Ce qui n'est PAS stocke reste inchange : les demandes de devis. Le document
depose par un client part vers WhatsApp et n'est pas conserve. Le CV d'un
repetiteur, lui, l'est — c'est un profil durable, pas une demande ponctuelle.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

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

    # Un client PEUT etre repetiteur, ou non : cote optionnel de la relation.
    # `uselist=False` -> au plus un profil ; supprimer le client emporte le profil.
    repetiteur: Mapped["Repetiteur | None"] = relationship(
        back_populates="client", uselist=False, cascade="all, delete-orphan"
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


class Repetiteur(Base):
    """Le profil d'encadreur d'un client, avec la reference de son CV.

    Relation volontairement simple : **un client, au plus un profil**. C'est ce
    que dit `unique=True` sur la cle etrangere — la contrainte vit en base, pas
    seulement dans le code.

    Le fichier n'est pas stocke ici : la table ne garde que son nom sur disque
    (`cv_fichier`, genere par nos soins) et son nom d'origine (`cv_nom_origine`,
    pour l'affichage et le telechargement). Le contenu vit dans le dossier de
    stockage, voir `stockage.py`.
    """

    # Nom au singulier : celui retenu au cahier des charges.
    __tablename__ = "repetiteur"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    # Saisi dans le formulaire : peut differer du nom du compte.
    nom: Mapped[str] = mapped_column(String(120), nullable=False)
    # Nom sur disque — genere aleatoirement, jamais celui fourni par le client.
    cv_fichier: Mapped[str] = mapped_column(String(80), nullable=False)
    cv_nom_origine: Mapped[str] = mapped_column(String(255), nullable=False)
    cv_octets: Mapped[int] = mapped_column(Integer, nullable=False)
    cree_le: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=lambda: datetime.now(timezone.utc)
    )
    maj_le: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    client: Mapped[Client] = relationship(back_populates="repetiteur")

    def __repr__(self) -> str:  # pragma: no cover - confort de debogage
        return f"<Repetiteur {self.id} client={self.client_id}>"
