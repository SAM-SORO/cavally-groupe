"""API FastAPI — deux espaces distincts, volontairement independants.

1. **Outil interne** (`POST /api/process`) : un document en entree, un devis
   Excel en sortie, en un seul appel. Les prix unitaires sont completes a la
   main dans le fichier telecharge.
2. **Espace clients externes** (`/api/auth/*`, `/api/demandes`) : inscription,
   connexion, et depot d'un document relaye a l'entreprise sur WhatsApp — sans
   conversion, sans extraction et sans enregistrement de la demande.

Les deux ne communiquent pas : c'est l'entreprise qui reprend manuellement le
document recu sur WhatsApp pour le passer dans l'outil interne.
"""

from __future__ import annotations

import base64
import json
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import quote

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from sqlalchemy.exc import OperationalError

from . import __version__
from .config import get_settings
from .db import base_disponible, initialiser_base
from .excel import build_filename, build_workbook
from .extraction import SUPPORTED_EXTENSIONS, ExtractionError, extract_supplies, ping_model
from .models import Admin
from .routes_admin import router as routeur_admin
from .routes_client import FORMATS_CLIENT, auth as routeur_auth, demandes as routeur_demandes
from .securite import admin_courant, admin_optionnel
from .whatsapp import obtenir_relais

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("cavally.api")

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

settings = get_settings()


@asynccontextmanager
async def cycle_de_vie(app: FastAPI):
    # La table clients est creee si besoin ; un echec n'empeche pas l'outil
    # interne de fonctionner, il ne depend pas de la base.
    initialiser_base()
    obtenir_relais()  # trace des le demarrage si le relais est simule
    yield


app = FastAPI(
    title="Cavally Livres — Devis fournitures",
    description=(
        "Outil interne : liste de fournitures → devis Excel. "
        "Espace clients : dépôt d'un document relayé à l'entreprise sur WhatsApp."
    ),
    version=__version__,
    lifespan=cycle_de_vie,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    # Necessaire au cookie de session de l'espace clients ; impose des origines
    # explicites (jamais « * »).
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    # Indispensable : le front lit le nom du fichier et le recapitulatif d'analyse.
    expose_headers=["Content-Disposition", "X-Devis-Meta"],
)

app.include_router(routeur_auth)
app.include_router(routeur_demandes)
app.include_router(routeur_admin)


@app.exception_handler(OperationalError)
async def base_injoignable(_requete, exception: OperationalError) -> JSONResponse:
    """Base absente : on le dit clairement plutot que de renvoyer une 500 brute."""
    logger.error("Base « cavally » injoignable : %s", exception)
    return JSONResponse(
        status_code=503,
        content={
            "detail": (
                "Le service clients est momentanément indisponible. "
                "Réessayez dans quelques instants."
            )
        },
    )


def _erreur(message: str, status_code: int = 422) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"detail": message})


@app.get("/api/health")
def health(probe: bool = False, admin: Admin | None = Depends(admin_optionnel)) -> dict:
    """Etat du service, public (aucun secret).

    `?probe=1` interroge reellement le modele configure et donne l'erreur exacte
    renvoyee par l'API — indispensable pour distinguer un modele retire, un
    quota atteint et une cle refusee. Comme cette sonde consomme des tokens
    Gemini, elle est **reservee aux admins**.
    """
    etat = {
        "status": "ok",
        "version": __version__,
        "model": settings.gemini_model,
        "gemini_configured": bool(settings.gemini_api_key),
        "formats": SUPPORTED_EXTENSIONS,
        "max_upload_mb": settings.max_upload_mb,
        # — Espace clients —
        "base_disponible": base_disponible(),
        "whatsapp_configure": obtenir_relais().configure,
        "formats_client": list(FORMATS_CLIENT),
    }
    if probe:
        if admin is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="La sonde du modèle est réservée aux administrateurs.",
            )
        etat["probe"] = ping_model()
    return etat


@app.post("/api/process")
async def process(
    fichier: UploadFile = File(..., alias="file"),
    # Verrou d'acces : l'outil interne n'est ouvert qu'a un admin authentifie.
    # Un visiteur anonyme comme un client externe connecte sont refuses ici,
    # avant meme la lecture du fichier. La logique metier en dessous est
    # inchangee.
    admin: Admin = Depends(admin_courant),
) -> Response:
    """Document uploade -> extraction Gemini -> devis .xlsx renvoye directement."""
    depart = time.perf_counter()
    nom = fichier.filename or "document"
    extension = Path(nom).suffix.lower()

    if extension not in SUPPORTED_EXTENSIONS:
        return _erreur(
            f"Format « {extension or 'inconnu'} » non supporté. "
            f"Formats acceptés : {', '.join(SUPPORTED_EXTENSIONS)}.",
            status_code=415,
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
            return _erreur(
                f"Fichier trop volumineux (limite {settings.max_upload_mb} Mo).",
                status_code=413,
            )
        morceaux.append(morceau)
    contenu = b"".join(morceaux)

    if not contenu:
        return _erreur("Le fichier reçu est vide.")

    logger.info("Analyse de « %s » (%.1f Ko)", nom, taille / 1024)

    try:
        extraction, tokens = extract_supplies(nom, contenu)
    except ExtractionError as exc:
        logger.warning("Extraction refusée : %s", exc.message)
        return _erreur(exc.message, status_code=exc.status_code)
    except Exception:
        logger.exception("Erreur inattendue pendant l'extraction")
        return _erreur("Une erreur inattendue est survenue pendant l'analyse.", status_code=500)

    if not extraction.articles:
        return _erreur(
            "Aucune fourniture n'a été détectée dans ce document. "
            "Vérifie qu'il s'agit bien d'une liste de fournitures lisible."
        )

    try:
        classeur = build_workbook(extraction)
    except Exception:
        logger.exception("Erreur pendant la génération du fichier Excel")
        return _erreur("La génération du fichier Excel a échoué.", status_code=500)

    nom_fichier = build_filename(extraction)
    recapitulatif = {
        "articles": len(extraction.articles),
        "quantites": extraction.total_quantites,
        "repartition": extraction.repartition,
        "etablissement": extraction.etablissement,
        # Un onglet par classe : le front adapte son affichage au nombre d'entrees.
        "classes": [
            {"nom": liste.classe, "articles": len(liste.articles)} for liste in extraction.listes
        ],
        "anneeScolaire": extraction.annee_scolaire,
        "fichier": nom_fichier,
        "tokens": tokens,
        "dureeMs": round((time.perf_counter() - depart) * 1000),
    }
    # En-tete HTTP = ASCII uniquement : on encode le JSON UTF-8 en base64.
    meta = base64.b64encode(json.dumps(recapitulatif, ensure_ascii=False).encode("utf-8")).decode("ascii")

    logger.info(
        "Devis « %s » généré — %d onglet(s), %d article(s) en %d ms",
        nom_fichier,
        len(extraction.listes),
        recapitulatif["articles"],
        recapitulatif["dureeMs"],
    )

    return Response(
        content=classeur,
        media_type=XLSX_MIME,
        headers={
            "Content-Disposition": (
                f'attachment; filename="{nom_fichier}"; '
                f"filename*=UTF-8''{quote(nom_fichier)}"
            ),
            "X-Devis-Meta": meta,
            "Cache-Control": "no-store",
        },
    )
