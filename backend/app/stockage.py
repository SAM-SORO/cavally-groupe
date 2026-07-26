"""Stockage sur disque des CV de repetiteurs.

C'est la **seule** chose que la plateforme conserve en fichier. Les documents
deposes par les clients continuent, eux, de partir sur WhatsApp sans jamais
toucher le disque : un CV est un profil durable, une liste de fournitures est
une demande ponctuelle.

Deux precautions valent d'etre dites :

1. **Le nom du fichier ne vient jamais du client.** Il est tire au sort
   (`secrets.token_hex`), et seule l'extension — validee au prealable — est
   reprise. Un client ne peut donc ecrire ni `../../.env`, ni ecraser le CV
   d'un autre en devinant son nom.
2. **La relecture est bornee au dossier de stockage.** `chemin_cv` resout le
   chemin et verifie qu'il reste sous la racine, meme si la valeur venait a
   etre alteree en base.
"""

from __future__ import annotations

import logging
import secrets
from pathlib import Path

from .config import get_settings

logger = logging.getLogger("cavally.stockage")

# Un CV est un document : ni image, ni tableur.
FORMATS_CV = (".pdf", ".docx", ".doc")

# Type MIME renvoye au telechargement, par extension.
MIME_CV = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
}

_settings = get_settings()


def racine() -> Path:
    """Dossier de stockage, cree au besoin."""
    dossier = _settings.stockage_cv
    dossier.mkdir(parents=True, exist_ok=True)
    return dossier


def extension_de(nom: str) -> str:
    return Path(nom).suffix.lower()


def format_accepte(nom: str) -> bool:
    return extension_de(nom) in FORMATS_CV


def enregistrer_cv(contenu: bytes, nom_origine: str) -> str:
    """Ecrit le CV sur disque et renvoie son nom de stockage.

    Le nom renvoye est celui a conserver en base ; il n'a aucun rapport avec
    celui fourni par le client.
    """
    extension = extension_de(nom_origine)
    if extension not in FORMATS_CV:
        # Garde-fou : l'appelant a normalement deja refuse le fichier.
        raise ValueError(f"Extension non autorisée pour un CV : « {extension} »")

    nom_stockage = f"{secrets.token_hex(16)}{extension}"
    (racine() / nom_stockage).write_bytes(contenu)
    logger.info("CV enregistré : %s (%.1f Ko)", nom_stockage, len(contenu) / 1024)
    return nom_stockage


def chemin_cv(nom_stockage: str) -> Path | None:
    """Chemin absolu du CV, ou None s'il est absent ou hors du dossier."""
    base = racine().resolve()
    # `.name` neutralise tout segment de chemin qui aurait survecu.
    candidat = (base / Path(nom_stockage).name).resolve()

    if not candidat.is_relative_to(base) or not candidat.is_file():
        return None
    return candidat


def supprimer_cv(nom_stockage: str) -> None:
    """Efface un CV remplace. Un fichier deja absent n'est pas une erreur."""
    chemin = chemin_cv(nom_stockage)
    if chemin is None:
        return
    try:
        chemin.unlink()
        logger.info("Ancien CV supprimé : %s", chemin.name)
    except OSError as exc:  # pragma: no cover - depend du systeme de fichiers
        logger.warning("Suppression du CV « %s » impossible : %s", chemin.name, exc)
