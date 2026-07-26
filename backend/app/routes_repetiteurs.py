"""Repetiteurs — profils d'encadreurs rattaches a un compte client.

Un client **peut** etre repetiteur, ou non : la relation est optionnelle d'un
cote, et unique de l'autre (au plus un profil par client). S'enregistrer une
seconde fois ne cree donc pas de doublon, cela **remplace** le profil existant
et efface l'ancien CV du disque.

La consultation est publique — c'est l'objet meme de la page, presenter les CV.
L'enregistrement, lui, exige une session client : c'est la seule action fermee
de ce module.

Ce module ne touche ni a Gemini, ni a openpyxl, ni au relais WhatsApp.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from .config import get_settings
from .db import get_db
from .models import Client, Repetiteur
from .securite import client_courant
from .stockage import FORMATS_CV, MIME_CV, enregistrer_cv, chemin_cv, extension_de, supprimer_cv

logger = logging.getLogger("cavally.repetiteurs")
settings = get_settings()

LONGUEUR_MIN_NOM = 2
LONGUEUR_MAX_NOM = 120

router = APIRouter(prefix="/api/repetiteurs", tags=["repetiteurs"])


class RepetiteurSortie(BaseModel):
    """Ce que la page affiche. Ni email, ni telephone : la page est publique."""

    id: int
    nom: str
    etablissement: str | None
    cv_nom: str
    cv_url: str
    cree_le: datetime


def _vers_sortie(repetiteur: Repetiteur) -> RepetiteurSortie:
    return RepetiteurSortie(
        id=repetiteur.id,
        nom=repetiteur.nom,
        etablissement=repetiteur.client.etablissement if repetiteur.client else None,
        cv_nom=repetiteur.cv_nom_origine,
        cv_url=f"/api/repetiteurs/{repetiteur.id}/cv",
        cree_le=repetiteur.cree_le,
    )


# --------------------------------------------------------------------------- #
# Consultation — publique
# --------------------------------------------------------------------------- #


@router.get("", response_model=list[RepetiteurSortie])
def lister(db: Session = Depends(get_db)) -> list[RepetiteurSortie]:
    """Les profils enregistres, du plus recent au plus ancien."""
    profils = (
        db.query(Repetiteur)
        # `joinedload` : l'etablissement vient du client, autant le charger
        # dans la meme requete plutot qu'une par ligne.
        .options(joinedload(Repetiteur.client))
        .order_by(Repetiteur.cree_le.desc())
        .all()
    )
    return [_vers_sortie(profil) for profil in profils]


@router.get("/moi", response_model=RepetiteurSortie | None)
def mon_profil(client: Client = Depends(client_courant), db: Session = Depends(get_db)):
    """Profil du client connecte, ou `null` s'il n'est pas repetiteur.

    Permet au front de proposer « S'enregistrer » ou « Mettre à jour mon CV »
    plutot que de laisser l'utilisateur decouvrir le doublon a la soumission.
    """
    profil = (
        db.query(Repetiteur)
        .options(joinedload(Repetiteur.client))
        .filter(Repetiteur.client_id == client.id)
        .first()
    )
    return _vers_sortie(profil) if profil else None


@router.get("/{repetiteur_id}/cv")
def telecharger_cv(repetiteur_id: int, db: Session = Depends(get_db)) -> FileResponse:
    """Sert le CV. Le nom d'origine n'est utilise que pour l'en-tete."""
    profil = db.get(Repetiteur, repetiteur_id)
    if profil is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ce profil n'existe pas.")

    chemin = chemin_cv(profil.cv_fichier)
    if chemin is None:
        # Entree en base sans fichier : anomalie, mais on ne renvoie pas une 500.
        logger.error("CV introuvable sur disque pour le répétiteur #%d", profil.id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ce CV n'est plus disponible.")

    return FileResponse(
        path=chemin,
        media_type=MIME_CV.get(extension_de(profil.cv_nom_origine), "application/octet-stream"),
        filename=profil.cv_nom_origine,
        # `inline` : le PDF s'ouvre dans l'onglet plutot que de se telecharger.
        content_disposition_type="inline",
    )


# --------------------------------------------------------------------------- #
# Enregistrement — reserve aux clients connectes
# --------------------------------------------------------------------------- #


@router.post("", response_model=RepetiteurSortie)
async def enregistrer(
    reponse: Response,
    nom: str = Form(...),
    fichier: UploadFile = File(..., alias="cv"),
    client: Client = Depends(client_courant),
    db: Session = Depends(get_db),
) -> RepetiteurSortie:
    """Cree — ou remplace — le profil repetiteur du client connecte."""
    nom = " ".join(nom.split())
    if not (LONGUEUR_MIN_NOM <= len(nom) <= LONGUEUR_MAX_NOM):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Le nom doit contenir entre {LONGUEUR_MIN_NOM} et {LONGUEUR_MAX_NOM} caractères.",
        )

    nom_fichier = fichier.filename or "cv"
    extension = extension_de(nom_fichier)
    if extension not in FORMATS_CV:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Format « {extension or 'inconnu'} » non pris en charge pour un CV. "
                f"Formats acceptés : {', '.join(FORMATS_CV)}."
            ),
        )

    # Lecture bornee : on refuse avant de tout charger en memoire.
    morceaux: list[bytes] = []
    taille = 0
    while True:
        morceau = await fichier.read(1024 * 1024)
        if not morceau:
            break
        taille += len(morceau)
        if taille > settings.max_upload_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Fichier trop volumineux (limite {settings.max_upload_mb} Mo).",
            )
        morceaux.append(morceau)

    contenu = b"".join(morceaux)
    if not contenu:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Le fichier reçu est vide."
        )

    profil = db.query(Repetiteur).filter(Repetiteur.client_id == client.id).first()
    ancien_cv = profil.cv_fichier if profil else None

    nom_stockage = enregistrer_cv(contenu, nom_fichier)

    if profil is None:
        profil = Repetiteur(
            client_id=client.id,
            nom=nom,
            cv_fichier=nom_stockage,
            cv_nom_origine=nom_fichier,
            cv_octets=taille,
        )
        db.add(profil)
        cree = True
    else:
        profil.nom = nom
        profil.cv_fichier = nom_stockage
        profil.cv_nom_origine = nom_fichier
        profil.cv_octets = taille
        profil.maj_le = datetime.now(timezone.utc)
        cree = False

    try:
        db.commit()
    except IntegrityError:
        # Course entre deux enregistrements du meme client : on n'a pas ecrit
        # en base, donc le fichier tout juste pose est orphelin — on l'efface.
        db.rollback()
        supprimer_cv(nom_stockage)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un profil de répétiteur existe déjà pour ce compte.",
        )

    # L'ancien fichier n'est efface qu'une fois le remplacement acte en base :
    # si le commit avait echoue, le profil pointerait encore dessus.
    if ancien_cv:
        supprimer_cv(ancien_cv)

    db.refresh(profil)
    reponse.status_code = status.HTTP_201_CREATED if cree else status.HTTP_200_OK
    logger.info(
        "Répétiteur %s — #%d %s (client #%d), CV %s",
        "enregistré" if cree else "mis à jour",
        profil.id,
        profil.nom,
        client.id,
        nom_fichier,
    )
    return _vers_sortie(profil)
