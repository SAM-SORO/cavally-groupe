"""Connexion administrateur — porte d'entree de l'outil interne.

Aucune route d'inscription : les comptes admin se creent uniquement en ligne
de commande (`python -m app.creer_admin`).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session

from .db import get_db
from .models import Admin
from .securite import (
    admin_courant,
    effacer_cookie_admin,
    poser_cookie_admin,
    verifier_mot_de_passe,
)

logger = logging.getLogger("cavally.admin")

router = APIRouter(prefix="/api/admin", tags=["outil interne"])


class ConnexionAdminEntree(BaseModel):
    email: EmailStr
    mot_de_passe: str = Field(min_length=1, max_length=128)

    @field_validator("email", mode="after")
    @classmethod
    def _minuscules(cls, valeur: EmailStr) -> str:
        return str(valeur).lower()


class AdminSortie(BaseModel):
    """Ce que le front reçoit — jamais l'empreinte du mot de passe."""

    id: int
    nom: str
    email: str

    model_config = {"from_attributes": True}


@router.post("/connexion", response_model=AdminSortie)
def connexion(entree: ConnexionAdminEntree, reponse: Response, db: Session = Depends(get_db)) -> Admin:
    admin = db.query(Admin).filter(Admin.email == entree.email).first()

    # Message identique dans les deux cas : on n'indique pas si le compte existe.
    if admin is None or not verifier_mot_de_passe(entree.mot_de_passe, admin.mot_de_passe_hash):
        logger.warning("Connexion admin refusée pour %s", entree.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants incorrects.",
        )

    admin.derniere_connexion = datetime.now(timezone.utc)
    db.commit()
    db.refresh(admin)

    poser_cookie_admin(reponse, admin.id)
    logger.info("Connexion admin #%d — %s", admin.id, admin.email)
    return admin


@router.post("/deconnexion", status_code=status.HTTP_204_NO_CONTENT)
def deconnexion() -> Response:
    # L'en-tete d'effacement doit etre pose sur la reponse REELLEMENT renvoyee.
    reponse = Response(status_code=status.HTTP_204_NO_CONTENT)
    effacer_cookie_admin(reponse)
    return reponse


@router.get("/moi", response_model=AdminSortie)
def moi(admin: Admin = Depends(admin_courant)) -> Admin:
    """Session admin courante — sert au front a decider s'il affiche l'outil."""
    return admin
