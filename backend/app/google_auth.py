"""Connexion avec un compte Google — verification du jeton d'identite.

Le navigateur obtient un **jeton d'identite** (`credential`) via le bouton
Google Identity Services, et nous l'envoie. Tout le travail se fait ici :
verifier la signature du jeton aupres de Google, son emetteur, son audience
et sa date d'expiration.

Deux points meritent d'etre dits.

1. **Le jeton n'est jamais cru sur parole.** `verify_oauth2_token` recupere
   les cles publiques de Google et controle la signature. Sans cela, n'importe
   qui pourrait forger un jeton disant « je suis untel@gmail.com ».
2. **Seul le `client_id` est necessaire**, pas de secret d'application : ce
   flux ne demande jamais de secret cote serveur, il n'y a donc rien de plus
   a proteger que la configuration elle-meme.

Tant que `GOOGLE_CLIENT_ID` n'est pas renseigne, le module se declare non
configure : le bouton disparait de l'interface et la route repond
proprement, au lieu d'echouer. Meme principe que le relais WhatsApp.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from google.auth.transport import requests as transport_google
from google.oauth2 import id_token

from .config import get_settings

logger = logging.getLogger("cavally.google")

# Les deux seuls emetteurs legitimes d'un jeton d'identite Google.
EMETTEURS = ("accounts.google.com", "https://accounts.google.com")

_settings = get_settings()


class JetonGoogleInvalide(Exception):
    """Le jeton presente n'est pas exploitable (signature, audience, expiration)."""


@dataclass(frozen=True)
class IdentiteGoogle:
    """Ce qu'on retient du jeton, et rien de plus."""

    sub: str  # identifiant stable du compte Google
    email: str
    nom: str


def configure() -> bool:
    return bool(_settings.google_client_id)


def verifier_credential(credential: str) -> IdentiteGoogle:
    """Valide le jeton et renvoie l'identite. Leve `JetonGoogleInvalide` sinon."""
    if not configure():
        raise JetonGoogleInvalide("La connexion Google n'est pas configurée sur ce serveur.")

    try:
        charge = id_token.verify_oauth2_token(
            credential,
            transport_google.Request(),
            _settings.google_client_id,
        )
    except ValueError as exc:
        # Signature invalide, jeton expire, audience qui ne correspond pas…
        logger.warning("Jeton Google refusé : %s", exc)
        raise JetonGoogleInvalide("Connexion Google refusée. Réessayez.") from exc

    if charge.get("iss") not in EMETTEURS:
        raise JetonGoogleInvalide("Connexion Google refusée. Réessayez.")

    # Un email non verifie ne prouve rien : on refuse de rattacher un compte
    # sur cette base, sinon n'importe qui pourrait revendiquer une adresse.
    if not charge.get("email_verified"):
        raise JetonGoogleInvalide(
            "Votre adresse Google n'est pas vérifiée. Utilisez une inscription classique."
        )

    email = (charge.get("email") or "").strip().lower()
    sujet = charge.get("sub")
    if not email or not sujet:
        raise JetonGoogleInvalide("Connexion Google refusée. Réessayez.")

    nom = (charge.get("name") or "").strip() or email.split("@")[0]
    return IdentiteGoogle(sub=str(sujet), email=email, nom=nom[:120])
