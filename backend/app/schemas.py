"""Modeles de donnees echanges entre l'extraction Gemini et la generation Excel.

Principe : le document uploade fait autorite sur son propre contenu. On ne lui
impose ni taxonomie de categories, ni consignes, ni decoupage en classes — tout
cela est repris tel qu'il apparait. Seule la *mise en forme* du devis est fixe.
"""

from __future__ import annotations

import re

from pydantic import BaseModel, Field, field_validator

LONGUEUR_MAX_CATEGORIE = 28
CATEGORIE_PAR_DEFAUT = "DIVERS"

_PUCES = r"^[\-–—•●▪·\*⁃\s]+"
_NUMEROTATION = r"^\(?\d{1,3}[\.\)\-]\s+"


def _texte(valeur: object) -> str:
    return re.sub(r"\s+", " ", str(valeur or "")).strip()


class Article(BaseModel):
    """Une ligne de la liste de fournitures."""

    designation: str
    qte: int = 1
    categorie: str = CATEGORIE_PAR_DEFAUT

    @field_validator("designation", mode="before")
    @classmethod
    def _nettoyer_designation(cls, valeur: object) -> str:
        texte = _texte(valeur)
        texte = re.sub(_PUCES, "", texte)
        texte = re.sub(_NUMEROTATION, "", texte)
        texte = texte.strip()
        # Le retrait de la quantite peut laisser une minuscule en tete
        # (« 3 cahiers de 200 pages » -> « cahiers... ») : c'est un livrable client.
        if texte[:1].islower():
            texte = texte[0].upper() + texte[1:]
        return texte

    @field_validator("qte", mode="before")
    @classmethod
    def _nettoyer_qte(cls, valeur: object) -> int:
        try:
            qte = int(float(str(valeur).replace(",", ".").strip()))
        except (TypeError, ValueError):
            return 1
        return qte if qte > 0 else 1

    @field_validator("categorie", mode="before")
    @classmethod
    def _nettoyer_categorie(cls, valeur: object) -> str:
        """Intitule libre : on reprend celui du document, sans le contraindre.

        On se contente de le normaliser (majuscules, sans puce ni deux-points)
        pour que la colonne reste homogene d'une ligne a l'autre.
        """
        texte = _texte(valeur)
        texte = re.sub(_PUCES, "", texte)
        texte = texte.strip(" :.-–—").strip()
        if not texte:
            return CATEGORIE_PAR_DEFAUT
        if len(texte) > LONGUEUR_MAX_CATEGORIE:
            texte = texte[:LONGUEUR_MAX_CATEGORIE].rstrip(" ,;-") + "…"
        return texte.upper()

    @property
    def categorie_label(self) -> str:
        return self.categorie


class ListeClasse(BaseModel):
    """Une liste de fournitures pour une classe donnee.

    Un meme document peut en contenir plusieurs (fascicule couvrant CP1 a CM2) ;
    il peut aussi n'en contenir qu'une, sans classe identifiee.
    """

    classe: str = ""
    consignes: list[str] = Field(default_factory=list)
    articles: list[Article] = Field(default_factory=list)

    @field_validator("classe", mode="before")
    @classmethod
    def _nettoyer_classe(cls, valeur: object) -> str:
        texte = _texte(valeur)
        # Les documents prefixent souvent le niveau (« NIVEAU : CM1 »,
        # « Classe - CE2 ») : on garde le nom seul, il sert de nom d'onglet.
        # Le separateur est exige, pour ne pas amputer « Cours Moyen 2 ».
        texte = re.sub(r"^(?:niveau|classe|section)\s*[:\-–—]\s*", "", texte, flags=re.I)
        return texte.strip(" :-–—").strip()

    @field_validator("consignes", mode="before")
    @classmethod
    def _nettoyer_consignes(cls, valeur: object) -> list[str]:
        if not isinstance(valeur, list):
            return []
        sorties: list[str] = []
        for element in valeur:
            texte = re.sub(_PUCES, "", _texte(element)).strip()
            if len(texte) >= 4:
                sorties.append(texte)
        return sorties[:8]

    @property
    def repartition(self) -> dict[str, int]:
        """Nombre d'articles par categorie, dans l'ordre d'apparition."""
        comptes: dict[str, int] = {}
        for article in self.articles:
            comptes[article.categorie] = comptes.get(article.categorie, 0) + 1
        return comptes

    @property
    def total_quantites(self) -> int:
        return sum(article.qte for article in self.articles)


class Extraction(BaseModel):
    """Resultat complet de l'analyse d'un document par Gemini."""

    etablissement: str = ""
    coordonnees: str = ""
    annee_scolaire: str = ""
    listes: list[ListeClasse] = Field(default_factory=list)

    @field_validator("etablissement", "coordonnees", "annee_scolaire", mode="before")
    @classmethod
    def _nettoyer_texte(cls, valeur: object) -> str:
        return _texte(valeur)

    @field_validator("listes", mode="before")
    @classmethod
    def _tolerer_forme_plate(cls, valeur: object) -> object:
        """Accepte aussi une reponse ne contenant qu'une liste d'articles."""
        if isinstance(valeur, list) and valeur and all(
            isinstance(e, dict) and "designation" in e for e in valeur
        ):
            return [{"classe": "", "consignes": [], "articles": valeur}]
        return valeur

    def elaguer(self) -> None:
        """Ecarte les lignes vides et les classes qui n'ont finalement rien."""
        for liste in self.listes:
            liste.articles = [a for a in liste.articles if len(a.designation) >= 2]
        self.listes = [liste for liste in self.listes if liste.articles]

    @property
    def articles(self) -> list[Article]:
        """Tous les articles du document, classes confondues."""
        return [article for liste in self.listes for article in liste.articles]

    @property
    def classes(self) -> list[str]:
        return [liste.classe for liste in self.listes if liste.classe]

    @property
    def repartition(self) -> dict[str, int]:
        comptes: dict[str, int] = {}
        for article in self.articles:
            comptes[article.categorie] = comptes.get(article.categorie, 0) + 1
        return comptes

    @property
    def total_quantites(self) -> int:
        return sum(article.qte for article in self.articles)
