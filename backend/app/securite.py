"""Authentification de l'espace clients.

Choix retenus :
- mot de passe **jamais** stocke en clair : bcrypt (cout 12) sur un pre-hachage
  SHA-256/base64, ce qui evite la troncature de bcrypt a 72 octets ;
- session portee par un **JWT dans un cookie HttpOnly** — inaccessible au
  JavaScript de la page, donc hors de portee d'une injection XSS, avec
  `SameSite=Lax` qui bloque l'envoi du cookie sur une requete inter-site.
"""

from __future__ import annotations

import base64
import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import Client

logger = logging.getLogger("cavally.securite")

NOM_COOKIE = "cavally_session"
COUT_BCRYPT = 12

_settings = get_settings()

if _settings.jwt_secret:
    _SECRET = _settings.jwt_secret
else:
    # Sans secret configure, on en genere un ephemere : l'application reste
    # utilisable, mais toutes les sessions tombent au redemarrage.
    _SECRET = secrets.token_urlsafe(48)
    logger.warning(
        "JWT_SECRET absent de backend/.env : un secret ephemere est utilise, "
        "les sessions ne survivront pas a un redemarrage."
    )


# --------------------------------------------------------------------------- #
# Mots de passe
# --------------------------------------------------------------------------- #


def _pre_hacher(mot_de_passe: str) -> bytes:
    """SHA-256 puis base64 : longueur fixe (44 octets), compatible bcrypt."""
    return base64.b64encode(hashlib.sha256(mot_de_passe.encode("utf-8")).digest())


def hacher_mot_de_passe(mot_de_passe: str) -> str:
    return bcrypt.hashpw(_pre_hacher(mot_de_passe), bcrypt.gensalt(rounds=COUT_BCRYPT)).decode("ascii")


def verifier_mot_de_passe(mot_de_passe: str, empreinte: str) -> bool:
    try:
        return bcrypt.checkpw(_pre_hacher(mot_de_passe), empreinte.encode("ascii"))
    except (ValueError, TypeError):
        return False


# --------------------------------------------------------------------------- #
# Session
# --------------------------------------------------------------------------- #


def creer_jeton(client_id: int) -> tuple[str, int]:
    """Renvoie (jeton, duree en secondes)."""
    duree = timedelta(hours=_settings.session_duree_heures)
    expiration = datetime.now(timezone.utc) + duree
    jeton = jwt.encode(
        {"sub": str(client_id), "exp": expiration, "iat": datetime.now(timezone.utc)},
        _SECRET,
        algorithm=_settings.jwt_algorithme,
    )
    return jeton, int(duree.total_seconds())


def poser_cookie_session(reponse: Response, client_id: int) -> None:
    jeton, duree = creer_jeton(client_id)
    reponse.set_cookie(
        key=NOM_COOKIE,
        value=jeton,
        max_age=duree,
        httponly=True,  # illisible depuis le JavaScript de la page
        samesite="lax",  # pas envoye sur une requete inter-site
        secure=_settings.cookie_securise,
        path="/",
    )


def effacer_cookie_session(reponse: Response) -> None:
    reponse.delete_cookie(key=NOM_COOKIE, path="/", samesite="lax", httponly=True)


NON_AUTHENTIFIE = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Session expirée ou absente. Connectez-vous pour continuer.",
)


def client_courant(requete: Request, db: Session = Depends(get_db)) -> Client:
    """Dependance des routes protegees."""
    jeton = requete.cookies.get(NOM_COOKIE)
    if not jeton:
        raise NON_AUTHENTIFIE

    try:
        charge = jwt.decode(jeton, _SECRET, algorithms=[_settings.jwt_algorithme])
        client_id = int(charge["sub"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        raise NON_AUTHENTIFIE

    client = db.get(Client, client_id)
    if client is None:
        raise NON_AUTHENTIFIE
    return client
