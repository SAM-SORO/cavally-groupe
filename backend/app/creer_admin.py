"""Creation d'un compte administrateur — en ligne de commande uniquement.

Il n'existe volontairement AUCUNE route d'inscription admin : c'est le seul
moyen de creer le premier compte, et les suivants.

    # arguments explicites
    python -m app.creer_admin --email chef@cavally.ci --nom "Chef d'équipe"

    # ou via l'environnement / le .env
    ADMIN_EMAIL=... ADMIN_NOM=... ADMIN_MOT_DE_PASSE=... python -m app.creer_admin

Sans `--mot-de-passe` ni `ADMIN_MOT_DE_PASSE`, le mot de passe est demande a la
saisie (masquee) — il ne reste alors ni dans l'historique du shell, ni dans un
fichier.
"""

from __future__ import annotations

import argparse
import getpass
import os
import re
import sys

from sqlalchemy.exc import SQLAlchemyError

from .db import SessionLocale, initialiser_base
from .models import Admin
from .securite import hacher_mot_de_passe

LONGUEUR_MIN_MOT_DE_PASSE = 8
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _analyser_arguments(argv: list[str] | None = None) -> argparse.Namespace:
    analyseur = argparse.ArgumentParser(
        prog="python -m app.creer_admin",
        description="Crée un compte administrateur pour l'outil interne Cavally Livres.",
    )
    analyseur.add_argument("--email", default=os.getenv("ADMIN_EMAIL", ""), help="identifiant de connexion")
    analyseur.add_argument("--nom", default=os.getenv("ADMIN_NOM", ""), help="nom affiché")
    analyseur.add_argument(
        "--mot-de-passe",
        dest="mot_de_passe",
        default=os.getenv("ADMIN_MOT_DE_PASSE", ""),
        help="mot de passe (demandé à la saisie si absent)",
    )
    analyseur.add_argument(
        "--forcer",
        action="store_true",
        help="si l'email existe déjà, remplace son mot de passe au lieu d'échouer",
    )
    return analyseur.parse_args(argv)


def _demander(question: str) -> str:
    try:
        return input(question).strip()
    except EOFError:
        return ""


def _obtenir_mot_de_passe(fourni: str) -> str:
    if fourni:
        return fourni
    if not sys.stdin.isatty():
        raise SystemExit(
            "Mot de passe absent. Passe --mot-de-passe, renseigne ADMIN_MOT_DE_PASSE, "
            "ou lance la commande dans un terminal interactif."
        )
    premier = getpass.getpass("Mot de passe : ")
    if premier != getpass.getpass("Confirme le mot de passe : "):
        raise SystemExit("Les deux saisies diffèrent.")
    return premier


def creer_admin(email: str, nom: str, mot_de_passe: str, forcer: bool = False) -> tuple[Admin, bool]:
    """Cree (ou met a jour si `forcer`) un admin. Renvoie (admin, cree)."""
    email = email.strip().lower()
    nom = " ".join(nom.split())

    if not _EMAIL.match(email):
        raise SystemExit(f"Email invalide : « {email} »")
    if len(nom) < 2:
        raise SystemExit("Le nom doit contenir au moins 2 caractères.")
    if len(mot_de_passe) < LONGUEUR_MIN_MOT_DE_PASSE:
        raise SystemExit(f"Le mot de passe doit contenir au moins {LONGUEUR_MIN_MOT_DE_PASSE} caractères.")

    with SessionLocale() as session:
        existant = session.query(Admin).filter(Admin.email == email).first()

        if existant is not None:
            if not forcer:
                raise SystemExit(
                    f"Un admin existe déjà avec « {email} ». Relance avec --forcer pour "
                    "remplacer son mot de passe."
                )
            existant.nom = nom
            existant.mot_de_passe_hash = hacher_mot_de_passe(mot_de_passe)
            session.commit()
            session.refresh(existant)
            return existant, False

        admin = Admin(email=email, nom=nom, mot_de_passe_hash=hacher_mot_de_passe(mot_de_passe))
        session.add(admin)
        session.commit()
        session.refresh(admin)
        return admin, True


def main(argv: list[str] | None = None) -> int:
    arguments = _analyser_arguments(argv)

    if not initialiser_base():
        print("Base « cavally » injoignable. Vérifie DATABASE_URL dans backend/.env.", file=sys.stderr)
        return 1

    email = arguments.email or _demander("Email : ")
    nom = arguments.nom or _demander("Nom affiché : ")
    mot_de_passe = _obtenir_mot_de_passe(arguments.mot_de_passe)

    try:
        admin, cree = creer_admin(email, nom, mot_de_passe, forcer=arguments.forcer)
    except SQLAlchemyError as exc:
        print(f"Échec de l'écriture en base : {exc}", file=sys.stderr)
        return 1

    action = "créé" if cree else "mis à jour"
    print(f"Admin {action} : #{admin.id} — {admin.nom} <{admin.email}>")
    print("Connexion sur /interne/connexion")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
