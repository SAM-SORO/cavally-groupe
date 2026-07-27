"""Espace administrateur — porte d'entree de l'outil interne, et gestion des CV.

Aucune route d'inscription : les comptes admin se creent uniquement en ligne
de commande (`python -m app.creer_admin`).

Le tableau de bord des repetiteurs vit ici plutot que dans
`routes_repetiteurs.py` : ce dernier sert la page publique, celui-ci sert
l'equipe. Les deux ne montrent pas les memes champs — l'equipe a besoin du
telephone et de l'email pour rappeler, le visiteur non.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session, joinedload

from .db import get_db
from .models import Admin, Repetiteur
from .securite import (
    admin_courant,
    effacer_cookie_admin,
    poser_cookie_admin,
    verifier_mot_de_passe,
)
from .stockage import supprimer_cv

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


# --------------------------------------------------------------------------- #
# Tableau de bord — gestion des CV de repetiteurs
# --------------------------------------------------------------------------- #


class RepetiteurAdminSortie(BaseModel):
    """Vue equipe : plus complete que la vue publique.

    Le telephone et l'email n'apparaissent QUE ici — la page publique des
    repetiteurs ne les expose pas.
    """

    id: int
    nom: str
    client_id: int
    email: str
    contact: str | None
    etablissement: str | None
    cv_nom: str
    cv_url: str
    cv_octets: int
    cree_le: datetime
    maj_le: datetime | None


def _vers_sortie_admin(profil: Repetiteur) -> RepetiteurAdminSortie:
    client = profil.client
    return RepetiteurAdminSortie(
        id=profil.id,
        nom=profil.nom,
        client_id=profil.client_id,
        email=client.email if client else "",
        contact=client.contact if client else None,
        etablissement=client.etablissement if client else None,
        cv_nom=profil.cv_nom_origine,
        cv_url=f"/api/repetiteurs/{profil.id}/cv",
        cv_octets=profil.cv_octets,
        cree_le=profil.cree_le,
        maj_le=profil.maj_le,
    )


@router.get("/repetiteurs", response_model=list[RepetiteurAdminSortie])
def lister_repetiteurs(
    admin: Admin = Depends(admin_courant), db: Session = Depends(get_db)
) -> list[RepetiteurAdminSortie]:
    """Tous les profils, du plus recent au plus ancien. Reserve a l'equipe."""
    profils = (
        db.query(Repetiteur)
        # L'email et le telephone viennent du client : une seule requete.
        .options(joinedload(Repetiteur.client))
        .order_by(Repetiteur.cree_le.desc())
        .all()
    )
    return [_vers_sortie_admin(profil) for profil in profils]


@router.delete("/repetiteurs/{repetiteur_id}", status_code=status.HTTP_204_NO_CONTENT)
def supprimer_repetiteur(
    repetiteur_id: int,
    admin: Admin = Depends(admin_courant),
    db: Session = Depends(get_db),
) -> Response:
    """Retire le profil et efface son CV du disque.

    Le compte client, lui, n'est PAS touche : la personne perd son profil de
    repetiteur, pas son acces a la plateforme.
    """
    profil = db.get(Repetiteur, repetiteur_id)
    if profil is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ce profil n'existe pas.")

    fichier = profil.cv_fichier
    nom = profil.nom
    db.delete(profil)
    db.commit()

    # Le fichier n'est efface qu'une fois la suppression actee en base : si le
    # commit avait echoue, le profil pointerait encore dessus.
    supprimer_cv(fichier)

    logger.info("Répétiteur #%d (%s) supprimé par l'admin #%d", repetiteur_id, nom, admin.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
