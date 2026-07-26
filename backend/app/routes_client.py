"""Espace clients externes : inscription, connexion, depot de document.

Ce module est independant de l'outil interne : aucun appel a Gemini, aucune
generation Excel. Le document depose par un client est relaye tel quel a
l'entreprise sur WhatsApp, puis ecarte — il n'est ni converti, ni stocke.
"""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .google_auth import JetonGoogleInvalide, verifier_credential
from .models import Client
from .redaction import (
    LONGUEUR_MAX_TEXTE,
    LONGUEUR_MIN_TEXTE,
    construire_docx,
    nom_fichier,
)
from .schemas_client import (
    ClientSortie,
    ConnexionEntree,
    DemandeSortie,
    GoogleEntree,
    InscriptionEntree,
    normaliser_contact,
)
from .securite import (
    client_courant,
    effacer_cookie_session,
    hacher_mot_de_passe,
    poser_cookie_session,
    verifier_mot_de_passe,
)
from .whatsapp import DocumentClient, RelaisIndisponible, obtenir_relais

logger = logging.getLogger("cavally.client")
settings = get_settings()

# Formats acceptes cote client. Liste propre a ce module : l'espace clients ne
# depend pas de l'outil interne.
FORMATS_CLIENT = (".pdf", ".docx", ".png", ".jpg", ".jpeg", ".webp", ".heic", ".heif")

auth = APIRouter(prefix="/api/auth", tags=["espace clients"])
demandes = APIRouter(prefix="/api/demandes", tags=["espace clients"])


# --------------------------------------------------------------------------- #
# Inscription / connexion
# --------------------------------------------------------------------------- #


@auth.post("/inscription", response_model=ClientSortie, status_code=status.HTTP_201_CREATED)
def inscription(entree: InscriptionEntree, reponse: Response, db: Session = Depends(get_db)) -> Client:
    """Cree le compte client en base et ouvre immediatement la session."""
    if db.query(Client).filter(Client.email == entree.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un compte existe déjà avec cette adresse email.",
        )

    client = Client(
        nom_complet=entree.nom_complet,
        contact=entree.contact,
        email=entree.email,
        etablissement=entree.etablissement,
        mot_de_passe_hash=hacher_mot_de_passe(entree.mot_de_passe),
    )
    db.add(client)
    try:
        db.commit()
    except IntegrityError:
        # Course entre deux inscriptions simultanees sur le meme email.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un compte existe déjà avec cette adresse email.",
        )
    db.refresh(client)

    poser_cookie_session(reponse, client.id)
    logger.info("Nouveau client #%d — %s (%s)", client.id, client.nom_complet, client.email)
    return client


@auth.post("/connexion", response_model=ClientSortie)
def connexion(entree: ConnexionEntree, reponse: Response, db: Session = Depends(get_db)) -> Client:
    client = db.query(Client).filter(Client.email == entree.email).first()

    # Message identique dans tous les cas : ni l'existence du compte, ni le
    # fait qu'il ait ete ouvert avec Google (donc sans mot de passe local) ne
    # doivent transparaitre.
    if (
        client is None
        or not client.mot_de_passe_hash
        or not verifier_mot_de_passe(entree.mot_de_passe, client.mot_de_passe_hash)
    ):
        logger.info("Connexion refusée pour %s", entree.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect.",
        )

    poser_cookie_session(reponse, client.id)
    logger.info("Connexion de #%d — %s", client.id, client.email)
    return client


@auth.post("/google", response_model=ClientSortie)
def connexion_google(entree: GoogleEntree, reponse: Response, db: Session = Depends(get_db)) -> Client:
    """Ouvre une session a partir d'un jeton d'identite Google.

    Une seule route pour l'inscription et la connexion : cote utilisateur, il
    n'y a qu'un bouton. Trois cas se presentent, dans cet ordre.

    1. Le `sub` Google est deja connu -> on retrouve le compte.
    2. L'email existe en compte local -> on **rattache** les deux. Google a
       verifie cette adresse, c'est bien la meme personne ; sans cela elle se
       retrouverait avec deux comptes pour une seule adresse.
    3. Sinon -> creation. Ni mot de passe, ni numero : le numero sera demande
       au moment du depot, la ou il sert.
    """
    try:
        identite = verifier_credential(entree.credential)
    except JetonGoogleInvalide as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))

    client = db.query(Client).filter(Client.google_sub == identite.sub).first()
    nouveau = False

    if client is None:
        client = db.query(Client).filter(Client.email == identite.email).first()
        if client is not None:
            client.google_sub = identite.sub
            logger.info("Compte #%d rattaché à Google (%s)", client.id, identite.email)
        else:
            client = Client(
                nom_complet=identite.nom,
                contact=None,
                email=identite.email,
                etablissement=None,
                mot_de_passe_hash=None,
                google_sub=identite.sub,
            )
            db.add(client)
            nouveau = True

    try:
        db.commit()
    except IntegrityError:
        # Course entre deux connexions simultanees sur le meme compte.
        db.rollback()
        client = db.query(Client).filter(Client.google_sub == identite.sub).first()
        if client is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Un compte existe déjà avec cette adresse email.",
            )
    db.refresh(client)

    poser_cookie_session(reponse, client.id)
    logger.info(
        "Connexion Google %s — #%d %s",
        "et création" if nouveau else "",
        client.id,
        client.email,
    )
    return client


@auth.post("/deconnexion", status_code=status.HTTP_204_NO_CONTENT)
def deconnexion() -> Response:
    # L'en-tete d'effacement doit etre pose sur la reponse REELLEMENT renvoyee :
    # ecrire sur une `Response` injectee puis en retourner une autre perdrait
    # le Set-Cookie, et la session resterait ouverte.
    reponse = Response(status_code=status.HTTP_204_NO_CONTENT)
    effacer_cookie_session(reponse)
    return reponse


@auth.get("/moi", response_model=ClientSortie)
def moi(client: Client = Depends(client_courant)) -> Client:
    """Session courante — sert au front a savoir s'il doit afficher l'espace."""
    return client


# --------------------------------------------------------------------------- #
# Depot d'une demande
# --------------------------------------------------------------------------- #


@demandes.post("", response_model=DemandeSortie, status_code=status.HTTP_202_ACCEPTED)
async def deposer(
    # Les deux entrees possibles — le client remplit l'une OU l'autre.
    fichier: UploadFile | None = File(default=None, alias="file"),
    texte: str | None = Form(default=None),
    # Complete le compte quand le numero manque — cas d'une ouverture par Google.
    contact: str | None = Form(default=None),
    client: Client = Depends(client_courant),
    db: Session = Depends(get_db),
) -> DemandeSortie:
    """Relaie la demande du client a l'entreprise sur WhatsApp.

    Deux entrees, **une seule sortie** : l'entreprise recoit toujours un
    document, jamais un long message texte qui se perdrait dans la
    conversation.

    - un fichier depose (PDF, Word, image) part **tel quel** ;
    - une liste tapee au clavier est **mise en document** (`.docx`) avant
      l'envoi, avec en tete les coordonnees du soumissionnaire.

    Dans les deux cas : aucune extraction Gemini, aucune generation Excel,
    aucun enregistrement. C'est l'equipe qui traitera le document, de son cote,
    dans l'outil interne.
    """
    # Le numero est indispensable ici, et seulement ici : c'est par lui que
    # l'equipe rappelle. On le reclame donc au moment du depot plutot qu'a
    # l'inscription, et on le garde sur le compte pour ne le demander qu'une fois.
    if not client.contact:
        if not contact:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Renseignez un numéro de téléphone : c'est par là que notre équipe vous recontacte.",
            )
        try:
            client.contact = normaliser_contact(contact)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
        db.commit()
        db.refresh(client)

    # Un champ fichier vide arrive tout de meme, sans nom : ce n'est pas un depot.
    depot_fichier = fichier is not None and bool(fichier.filename)
    saisie = (texte or "").strip()

    if not depot_fichier and not saisie:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Déposez un document ou saisissez votre liste de fournitures.",
        )

    if depot_fichier:
        # — Cas 1 et 2 : le document du client part tel quel —
        nom = fichier.filename or "document"
        extension = Path(nom).suffix.lower()

        if extension not in FORMATS_CLIENT:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=(
                    f"Format « {extension or 'inconnu'} » non pris en charge. "
                    f"Formats acceptés : {', '.join(FORMATS_CLIENT)}."
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
        redige = False
    else:
        # — Cas 3 : la liste tapee devient un document —
        if len(saisie) < LONGUEUR_MIN_TEXTE:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Votre liste est trop courte pour être transmise.",
            )
        if len(saisie) > LONGUEUR_MAX_TEXTE:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Votre liste dépasse {LONGUEUR_MAX_TEXTE} caractères. Déposez plutôt un document.",
            )
        try:
            contenu = construire_docx(client, saisie)
        except Exception:
            logger.exception("Rédaction du document impossible pour #%d", client.id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="La mise en document de votre liste a échoué. Réessayez dans un instant.",
            )
        nom = nom_fichier(client)
        taille = len(contenu)
        redige = True

    document = DocumentClient(nom_fichier=nom, contenu=contenu)
    relais = obtenir_relais()

    try:
        resultat = relais.envoyer_demande(client, document)
    except RelaisIndisponible as exc:
        # Le relais est configure mais a echoue : on ne fait pas croire au
        # client que sa demande est partie.
        logger.error("Relais WhatsApp en échec pour #%d : %s", client.id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Votre document n'a pas pu être transmis. Réessayez dans un instant.",
        )

    logger.info(
        "Demande de #%d (%s) — %s (%s), %.1f Ko — %s",
        client.id,
        client.nom_complet,
        nom,
        "rédigé depuis la saisie" if redige else "déposé par le client",
        taille / 1024,
        "transmise" if resultat.transmis else "SIMULÉE",
    )

    return DemandeSortie(
        message="Votre demande a bien été reçue. Notre équipe la prend en charge et vous recontacte.",
        fichier=nom,
        transmis=resultat.transmis,
    )
