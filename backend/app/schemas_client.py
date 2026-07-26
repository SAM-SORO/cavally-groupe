"""Schemas d'entree/sortie de l'espace clients."""

from __future__ import annotations

import re

from pydantic import BaseModel, EmailStr, Field, field_validator

LONGUEUR_MIN_MOT_DE_PASSE = 8
LONGUEUR_MAX_MOT_DE_PASSE = 128

# Numero international tolerant : « +225 07 97 99 19 99 », « 0797991999 »...
_SEPARATEURS = re.compile(r"[\s.\-()/]")
_CONTACT_VALIDE = re.compile(r"^\+?\d{8,15}$")


class InscriptionEntree(BaseModel):
    nom_complet: str = Field(min_length=2, max_length=120)
    contact: str = Field(min_length=6, max_length=32)
    email: EmailStr
    # Facultatif : vide pour un particulier.
    etablissement: str | None = Field(default=None, max_length=160)
    mot_de_passe: str = Field(min_length=LONGUEUR_MIN_MOT_DE_PASSE, max_length=LONGUEUR_MAX_MOT_DE_PASSE)

    @field_validator("nom_complet", mode="before")
    @classmethod
    def _nettoyer_nom(cls, valeur: object) -> str:
        return re.sub(r"\s+", " ", str(valeur or "")).strip()

    @field_validator("etablissement", mode="before")
    @classmethod
    def _nettoyer_etablissement(cls, valeur: object) -> str | None:
        texte = re.sub(r"\s+", " ", str(valeur or "")).strip()
        return texte or None

    @field_validator("contact", mode="before")
    @classmethod
    def _normaliser_contact(cls, valeur: object) -> str:
        texte = _SEPARATEURS.sub("", str(valeur or "").strip())
        if not _CONTACT_VALIDE.match(texte):
            raise ValueError("Numéro de téléphone invalide (8 à 15 chiffres, indicatif optionnel).")
        return texte

    @field_validator("email", mode="after")
    @classmethod
    def _minuscules(cls, valeur: EmailStr) -> str:
        return str(valeur).lower()


class ConnexionEntree(BaseModel):
    email: EmailStr
    mot_de_passe: str = Field(min_length=1, max_length=LONGUEUR_MAX_MOT_DE_PASSE)

    @field_validator("email", mode="after")
    @classmethod
    def _minuscules(cls, valeur: EmailStr) -> str:
        return str(valeur).lower()


class ClientSortie(BaseModel):
    """Ce que le front reçoit — jamais l'empreinte du mot de passe."""

    id: int
    nom_complet: str
    contact: str
    email: str
    etablissement: str | None

    model_config = {"from_attributes": True}


class DemandeSortie(BaseModel):
    """Accuse de reception d'une demande. Rien n'est persiste."""

    message: str
    fichier: str
    transmis: bool
