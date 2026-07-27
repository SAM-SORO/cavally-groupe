"""Messages de validation en francais.

Pydantic renvoie ses erreurs en anglais, dans une langue de developpeur :
« value is not a valid email address: An email address must have an @-sign. »
Un client n'a pas a lire cela.

Plutot que de traduire champ par champ dans chaque modele, on intercepte
`RequestValidationError` une seule fois et on reformule. Toute route qui
validera une entree demain en beneficie sans rien ecrire.
"""

from __future__ import annotations

# Le champ tel qu'il s'appelle dans l'interface. Sert de sujet a la phrase,
# d'ou la majuscule et l'article.
LIBELLES = {
    "email": "L'adresse email",
    "nom_complet": "Le nom complet",
    "nom": "Le nom",
    "contact": "Le numéro de téléphone",
    "telephone": "Le numéro de téléphone",
    "mot_de_passe": "Le mot de passe",
    "etablissement": "L'établissement",
    "texte": "La liste saisie",
    "credential": "La connexion Google",
}

MESSAGE_PAR_DEFAUT = "Certaines informations sont invalides. Vérifiez votre saisie."


def _libelle(champ: str) -> str:
    return LIBELLES.get(champ, "Ce champ")


def message_francais(erreur: dict) -> str:
    """Reformule UNE erreur Pydantic en une phrase lisible."""
    type_erreur = str(erreur.get("type", ""))
    contexte = erreur.get("ctx") or {}

    # `loc` vaut par exemple ("body", "email") : le dernier segment est le champ.
    emplacement = erreur.get("loc") or ()
    champ = str(emplacement[-1]) if emplacement else ""
    libelle = _libelle(champ)

    if type_erreur == "missing":
        return f"{libelle} est obligatoire."

    if type_erreur == "string_too_short":
        minimum = contexte.get("min_length")
        if champ == "credential":
            return "La connexion Google a échoué. Réessayez."
        return f"{libelle} doit contenir au moins {minimum} caractères."

    if type_erreur == "string_too_long":
        return f"{libelle} ne doit pas dépasser {contexte.get('max_length')} caractères."

    if type_erreur in {"int_parsing", "int_type", "float_parsing"}:
        return f"{libelle} doit être un nombre."

    if type_erreur in {"string_type", "bool_type"}:
        return f"{libelle} n'est pas au bon format."

    # Adresse email : le message d'origine parle d'arobase et de domaine.
    if champ == "email":
        return "Adresse email invalide."

    if type_erreur == "value_error":
        # Nos propres validateurs levent deja un message francais ; Pydantic
        # le prefixe de « Value error, », qu'on retire.
        propre = str(erreur.get("msg", "")).removeprefix("Value error, ").strip()
        return propre or MESSAGE_PAR_DEFAUT

    return MESSAGE_PAR_DEFAUT


def premier_message(erreurs: list[dict]) -> str:
    """La premiere erreur suffit : l'interface n'affiche qu'une ligne.

    Corriger champ par champ vaut mieux qu'un pave de cinq phrases dans une
    alerte qui n'a deliberement plus de cadre.
    """
    for erreur in erreurs:
        message = message_francais(erreur)
        if message:
            return message
    return MESSAGE_PAR_DEFAUT
