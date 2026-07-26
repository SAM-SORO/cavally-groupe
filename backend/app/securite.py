"""Authentification — deux espaces, deux sessions strictement separees.

Choix retenus :
- mot de passe **jamais** stocke en clair : bcrypt (cout 12) sur un pre-hachage
  SHA-256/base64, ce qui evite la troncature de bcrypt a 72 octets ;
- session portee par un **JWT dans un cookie HttpOnly** — inaccessible au
  JavaScript de la page, donc hors de portee d'une injection XSS, avec
  `SameSite=Lax` qui bloque l'envoi du cookie sur une requete inter-site.

**Separation des roles.** Un client et un admin n'utilisent ni le meme cookie,
ni le meme jeton : le nom du cookie differe ET le role est inscrit dans la
charge du JWT, puis verifie a chaque requete. Une session client presentee sur
une route admin est donc rejetee deux fois plutot qu'une.
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
from .models import Admin, Client

logger = logging.getLogger("cavally.securite")

ROLE_CLIENT = "client"
ROLE_ADMIN = "admin"

NOM_COOKIE = "cavally_session"  # espace clients
NOM_COOKIE_ADMIN = "cavally_admin"  # outil interne

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
# Jetons et cookies
# --------------------------------------------------------------------------- #


def _creer_jeton(sujet_id: int, role: str) -> tuple[str, int]:
    """Renvoie (jeton, duree en secondes). Le role est scelle dans la charge."""
    duree = timedelta(hours=_settings.session_duree_heures)
    maintenant = datetime.now(timezone.utc)
    jeton = jwt.encode(
        {"sub": str(sujet_id), "role": role, "exp": maintenant + duree, "iat": maintenant},
        _SECRET,
        algorithm=_settings.jwt_algorithme,
    )
    return jeton, int(duree.total_seconds())


def _poser_cookie(reponse: Response, nom: str, sujet_id: int, role: str) -> None:
    jeton, duree = _creer_jeton(sujet_id, role)
    reponse.set_cookie(
        key=nom,
        value=jeton,
        max_age=duree,
        httponly=True,  # illisible depuis le JavaScript de la page
        samesite="lax",  # pas envoye sur une requete inter-site
        secure=_settings.cookie_securise,
        path="/",
    )


def _effacer_cookie(reponse: Response, nom: str) -> None:
    reponse.delete_cookie(key=nom, path="/", samesite="lax", httponly=True)


def _sujet_depuis_cookie(requete: Request, nom: str, role_attendu: str) -> int | None:
    """Identifiant du porteur du cookie, si le jeton est valide ET du bon role."""
    jeton = requete.cookies.get(nom)
    if not jeton:
        return None
    try:
        charge = jwt.decode(jeton, _SECRET, algorithms=[_settings.jwt_algorithme])
    except jwt.PyJWTError:
        return None

    # Verrou de role : un jeton client presente ici ne passe pas.
    if charge.get("role") != role_attendu:
        logger.warning("Jeton de role « %s » présenté sur un accès « %s »", charge.get("role"), role_attendu)
        return None

    try:
        return int(charge["sub"])
    except (KeyError, TypeError, ValueError):
        return None


# --------------------------------------------------------------------------- #
# Espace clients
# --------------------------------------------------------------------------- #


def poser_cookie_session(reponse: Response, client_id: int) -> None:
    _poser_cookie(reponse, NOM_COOKIE, client_id, ROLE_CLIENT)


def effacer_cookie_session(reponse: Response) -> None:
    _effacer_cookie(reponse, NOM_COOKIE)


NON_AUTHENTIFIE = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Session expirée ou absente. Connectez-vous pour continuer.",
)


def client_courant(requete: Request, db: Session = Depends(get_db)) -> Client:
    """Dependance des routes de l'espace clients."""
    client_id = _sujet_depuis_cookie(requete, NOM_COOKIE, ROLE_CLIENT)
    if client_id is None:
        raise NON_AUTHENTIFIE

    client = db.get(Client, client_id)
    if client is None:
        raise NON_AUTHENTIFIE
    return client


# --------------------------------------------------------------------------- #
# Outil interne (admins)
# --------------------------------------------------------------------------- #


def poser_cookie_admin(reponse: Response, admin_id: int) -> None:
    _poser_cookie(reponse, NOM_COOKIE_ADMIN, admin_id, ROLE_ADMIN)


def effacer_cookie_admin(reponse: Response) -> None:
    _effacer_cookie(reponse, NOM_COOKIE_ADMIN)


NON_AUTORISE = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Accès réservé à l'équipe Cavally. Connectez-vous avec un compte administrateur.",
)


def admin_optionnel(requete: Request, db: Session = Depends(get_db)) -> Admin | None:
    """Comme `admin_courant`, mais renvoie None au lieu de refuser.

    Sert aux routes publiques dont seule une partie est reservee.
    """
    admin_id = _sujet_depuis_cookie(requete, NOM_COOKIE_ADMIN, ROLE_ADMIN)
    return db.get(Admin, admin_id) if admin_id is not None else None


def admin_courant(requete: Request, db: Session = Depends(get_db)) -> Admin:
    """Dependance de TOUTES les routes de l'outil interne.

    Un visiteur anonyme comme un client externe connecte sont refuses : le
    cookie client ne porte ni le bon nom, ni le bon role.
    """
    admin_id = _sujet_depuis_cookie(requete, NOM_COOKIE_ADMIN, ROLE_ADMIN)
    if admin_id is None:
        raise NON_AUTORISE

    admin = db.get(Admin, admin_id)
    if admin is None:
        raise NON_AUTORISE
    return admin
