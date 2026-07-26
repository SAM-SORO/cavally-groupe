"""Relais WhatsApp — transmet la demande d'un client a l'entreprise.

Le module est volontairement isole derriere une interface (`RelaisWhatsApp`) :
le reste de l'application ne connait que `obtenir_relais()` et
`envoyer_demande()`. Deux implementations existent.

- `RelaisSimule` : tant que WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID et
  WHATSAPP_DESTINATAIRE ne sont pas tous renseignes, l'envoi est journalise et
  le flux client aboutit normalement.
- `RelaisCloudAPI` : des que les trois sont fournis, l'envoi devient reel —
  aucune autre ligne de code a modifier.

Rien n'est persiste ici : le document est relaye puis ecarte.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Protocol

import httpx

from .config import ParametresWhatsApp, get_settings
from .models import Client

logger = logging.getLogger("cavally.whatsapp")

TYPES_MIME = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".heic": "image/heic",
    ".heif": "image/heif",
}
TYPE_MIME_PAR_DEFAUT = "application/octet-stream"

LONGUEUR_MAX_LEGENDE = 1024
DELAI_HTTP = 30.0


class RelaisIndisponible(Exception):
    """Le relais est configure mais l'envoi a echoue."""


@dataclass(frozen=True)
class DocumentClient:
    """Le fichier tel que le client l'a depose — jamais converti, jamais stocke."""

    nom_fichier: str
    contenu: bytes

    @property
    def type_mime(self) -> str:
        return TYPES_MIME.get(Path(self.nom_fichier).suffix.lower(), TYPE_MIME_PAR_DEFAUT)

    @property
    def taille_ko(self) -> int:
        return max(1, len(self.contenu) // 1024)


@dataclass(frozen=True)
class ResultatEnvoi:
    transmis: bool
    simule: bool
    detail: str
    identifiant: str | None = None


def composer_legende(client: Client, document: DocumentClient) -> str:
    """Message qui accompagne le document : qui demande, et comment le joindre."""
    lignes = [
        "Nouvelle demande de devis — Cavally Livres",
        "",
        f"Client : {client.nom_complet}",
        # Le depot exige un numero ; la garde ne sert qu'a ne jamais afficher
        # « Contact : None » a l'equipe si le cas se presentait.
        f"Contact : {client.contact or 'non renseigné'}",
    ]
    if client.etablissement:
        lignes.append(f"Établissement : {client.etablissement}")
    lignes += [
        f"Email : {client.email}",
        "",
        f"Document : {document.nom_fichier} ({document.taille_ko} Ko)",
        f"Déposé le {datetime.now().strftime('%d/%m/%Y à %H:%M')}",
    ]
    return "\n".join(lignes)[:LONGUEUR_MAX_LEGENDE]


class RelaisWhatsApp(Protocol):
    """Contrat commun aux implementations."""

    configure: bool

    def envoyer_demande(self, client: Client, document: DocumentClient) -> ResultatEnvoi: ...


class RelaisSimule:
    """Trace l'envoi sans appeler quoi que ce soit. Ne fait jamais echouer le flux."""

    configure = False

    def __init__(self, raison: str) -> None:
        self.raison = raison

    def envoyer_demande(self, client: Client, document: DocumentClient) -> ResultatEnvoi:
        logger.warning(
            "WhatsApp SIMULÉ (%s) — la demande n'a PAS été transmise.\n%s",
            self.raison,
            composer_legende(client, document),
        )
        return ResultatEnvoi(
            transmis=False,
            simule=True,
            detail=f"Relais WhatsApp non configuré ({self.raison}) : envoi simulé et journalisé.",
        )


class RelaisCloudAPI:
    """WhatsApp Cloud API (Meta) : le document est televerse, puis envoye."""

    configure = True

    def __init__(self, parametres: ParametresWhatsApp) -> None:
        self.p = parametres
        self._base = f"{parametres.api_url.rstrip('/')}/{parametres.api_version}"

    @property
    def _entetes(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.p.token}"}

    def _televerser(self, client_http: httpx.Client, document: DocumentClient) -> str:
        reponse = client_http.post(
            f"{self._base}/{self.p.phone_number_id}/media",
            headers=self._entetes,
            data={"messaging_product": "whatsapp", "type": document.type_mime},
            files={"file": (document.nom_fichier, document.contenu, document.type_mime)},
        )
        if reponse.status_code >= 400:
            raise RelaisIndisponible(f"téléversement refusé ({reponse.status_code}) : {reponse.text[:300]}")
        identifiant = reponse.json().get("id")
        if not identifiant:
            raise RelaisIndisponible("téléversement sans identifiant de média")
        return identifiant

    def _envoyer(
        self, client_http: httpx.Client, media_id: str, document: DocumentClient, legende: str
    ) -> str:
        reponse = client_http.post(
            f"{self._base}/{self.p.phone_number_id}/messages",
            headers={**self._entetes, "Content-Type": "application/json"},
            json={
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": self.p.destinataire,
                "type": "document",
                "document": {
                    "id": media_id,
                    "filename": document.nom_fichier,
                    "caption": legende,
                },
            },
        )
        if reponse.status_code >= 400:
            raise RelaisIndisponible(f"envoi refusé ({reponse.status_code}) : {reponse.text[:300]}")
        messages = reponse.json().get("messages") or [{}]
        return messages[0].get("id", "")

    def envoyer_demande(self, client: Client, document: DocumentClient) -> ResultatEnvoi:
        legende = composer_legende(client, document)
        try:
            with httpx.Client(timeout=DELAI_HTTP) as client_http:
                media_id = self._televerser(client_http, document)
                message_id = self._envoyer(client_http, media_id, document, legende)
        except RelaisIndisponible:
            raise
        except httpx.HTTPError as exc:
            raise RelaisIndisponible(f"réseau indisponible : {exc}") from exc

        logger.info(
            "Demande de %s (%s) transmise sur WhatsApp — message %s, document %s",
            client.nom_complet,
            client.contact,
            message_id,
            document.nom_fichier,
        )
        return ResultatEnvoi(
            transmis=True,
            simule=False,
            detail="Document transmis à l'entreprise sur WhatsApp.",
            identifiant=message_id,
        )


@lru_cache(maxsize=1)
def obtenir_relais() -> RelaisWhatsApp:
    """Choisit l'implementation selon ce qui est reellement configure."""
    parametres = get_settings().whatsapp
    if parametres.configure:
        logger.info(
            "Relais WhatsApp actif — destinataire %s, API %s",
            parametres.destinataire,
            parametres.api_version,
        )
        return RelaisCloudAPI(parametres)

    manquants = [
        nom
        for nom, valeur in (
            ("WHATSAPP_TOKEN", parametres.token),
            ("WHATSAPP_PHONE_NUMBER_ID", parametres.phone_number_id),
            ("WHATSAPP_DESTINATAIRE", parametres.destinataire),
        )
        if not valeur
    ]
    logger.warning("Relais WhatsApp en mode simulé — variables manquantes : %s", ", ".join(manquants))
    return RelaisSimule(f"{', '.join(manquants)} non renseigné(s)")
