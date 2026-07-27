# CLAUDE.md — Traitement automatisé des listes de fournitures

Ce fichier donne à Claude Code le contexte complet du projet. Lis-le en entier avant de coder.

---

## 1. Objectif

Plateforme qui reçoit une **liste de fournitures scolaires** (déposée par nous ou par le client), au format **Word, PDF ou capture d'écran / photo**. Un **modèle IA (Gemini Flash)** analyse le document, en extrait les articles et leurs quantités, puis le système génère un **fichier Excel structuré et prêt à être chiffré** (base de devis pour les cahiers et fournitures).

Le résultat doit être **propre, fiable et professionnel** : c'est un livrable client.

### Deux espaces, volontairement indépendants

| Espace | Qui | Accès | Ce qu'il fait |
|---|---|---|---|
| **Outil interne** (`/interne`) | l'équipe Cavally | **admin authentifié obligatoire** | document → Gemini → devis Excel |
| **Espace public** (`/`, `/temoignages`, `/repetiteurs`, `/inscription`, `/connexion`) | les clients externes | pages ouvertes, **actions** réservées aux inscrits | dépôt d'un document **relayé sur WhatsApp**, témoignages vidéo, CV des répétiteurs |

L'espace public est organisé par une **navbar à trois menus** — Accueil,
Témoignage, Répétiteur. Voir la section 14.

⚠️ **Les deux ne communiquent pas.** Le dépôt d'un client ne déclenche **ni extraction Gemini, ni génération Excel**. Le document part tel quel sur WhatsApp ; c'est ensuite l'équipe qui, de son côté, le repasse manuellement dans l'outil interne. Voir la section 12.

⚠️ **L'outil interne est fermé.** Toutes ses routes et pages exigent une session **administrateur**. Un visiteur anonyme comme un client externe connecté sont refusés — y compris en appelant l'API directement. Voir la section 13.

---

## 2. Assets déjà présents dans le dépôt

**⚠️ Avant de commencer, ouvre et inspecte ces fichiers** — ils sont la source de vérité pour l'identité visuelle et le format de sortie :

- **Logo de l'entreprise** — à utiliser dans l'interface (header) et, si pertinent, dans l'Excel généré.
- **Code couleur / charte** — respecte scrupuleusement ces couleurs pour toute l'UI. Ne pas inventer de palette. Récupère les valeurs hex depuis ce fichier et centralise-les (variables CSS / thème).
- **Exemple de fichier Excel généré** — c'est le **format cible exact**. Reproduis sa structure (colonnes, ordre, mise en forme, formules, format monétaire). En cas de doute sur le rendu attendu, cet exemple prime sur ce document.

> Si un chemin n'est pas évident, liste le contenu du dossier et identifie le logo (`.png`/`.svg`), le fichier de couleurs et le `.xlsx` d'exemple avant toute décision de design.

---

## 3. Stack technique

| Couche | Techno | Rôle |
|---|---|---|
| Frontend | **React + Vite + react-router** | Outil interne + espace clients |
| Backend | **Python + FastAPI** | Réception fichier, appel Gemini, génération Excel, API clients |
| IA | **Gemini Flash** (Google AI Studio) | Lecture multimodale → JSON structuré |
| Génération Excel | **openpyxl** | Fichier `.xlsx` avec **vraies formules** |
| Lecture docs | **PyMuPDF / python-docx** | Normalisation légère si besoin |
| Base de données | **PostgreSQL 17** (base `cavally`) | **Uniquement `clients`, `admins` et `repetiteurs`** |
| Auth | **bcrypt + JWT en cookie HttpOnly** | Sessions clients ET admins, cloisonnées |
| Auth (option) | **Google Identity Services + google-auth** | « Continuer avec Google », jeton vérifié côté serveur |
| Notification | **WhatsApp Cloud API** | Relais des demandes clients vers l'entreprise |

La **clé API Gemini existe déjà**. Elle est lue depuis la variable d'environnement `GEMINI_API_KEY` (fichier `.env`, jamais committée). Le nom du modèle est configurable via `GEMINI_MODEL`.

⚠️ **Vérifier le modèle Flash actif** : `gemini-2.5-flash` renvoie désormais `404 — no longer available to new users`. Le défaut est `gemini-flash-latest` (alias qui suit le Flash courant). Attention aussi au quota : le palier gratuit est limité à **20 requêtes par jour et par modèle**, et les alias `-latest` partagent le compteur du modèle qu'ils désignent. `GET /api/health?probe=1` interroge réellement le modèle et renvoie l'erreur exacte.

---

## 4. Architecture / flux de données

```
React (upload)  ──►  FastAPI  ──►  Gemini Flash (extraction JSON)
      ▲                 │
      │                 ▼
  tableau éditable ◄── liste [{designation, qte}]
      │
      ▼ (saisie des prix unitaires)
  FastAPI (openpyxl) ──► .xlsx avec formules ──► téléchargement
```

**Principe directeur : un seul chemin d'extraction.** Ne code **pas** trois parseurs par format. Word/PDF/image passent tous par Gemini (multimodal). Un `.docx` peut éventuellement être converti en texte avant l'envoi, mais l'image et le PDF partent directement au modèle.

### Endpoints backend (proposition)

- `POST /api/extract` — reçoit le fichier uploadé, appelle Gemini, renvoie `{ "items": [{ "designation": str, "qte": int }] }`.
- `POST /api/generate-excel` — reçoit la liste finale (avec prix unitaires saisis), renvoie le `.xlsx`.

---

## 5. Intégration Gemini — prompt d'extraction

Appeler Gemini en **sortie JSON stricte** (`response_mime_type: "application/json"`, et de préférence un `responseSchema`). Envoyer le document (image/PDF en `inline_data`, ou texte pour un `.docx`) accompagné de ce prompt :

```
Tu analyses une liste de fournitures scolaires. Le document peut être
un texte, un PDF ou une image (capture ou photo).

Extrais chaque article avec sa quantité et renvoie UNIQUEMENT un tableau
JSON valide, sans aucun texte avant ou après, sans balises Markdown.

Format exact :
[
  { "designation": "<libellé de l'article>", "qte": <entier> }
]

Règles :
- "designation" : reprends le libellé tel qu'il apparaît, débarrassé des
  puces et numéros de liste.
- "qte" : le nombre indiqué. Si aucune quantité n'est précisée, mets 1.
- Ignore ce qui n'est pas un article : titres de section, en-têtes, nom de
  l'école ou de la classe, mentions générales (ex. « Rentrée 2025 »,
  « Classe de CE2 »).
- N'invente rien et ne regroupe pas les articles. Un article = une ligne.
- Conserve l'ordre d'apparition dans le document.
- Si le document est illisible ou ne contient aucune fourniture, renvoie [].
```

Toujours **valider/parser** la réponse côté backend (try/except) avant de la renvoyer au front. Logger le champ `usage` (tokens consommés) de chaque réponse pour suivre la consommation.

---

## 6. Génération Excel (openpyxl) — règles impératives

Se caler sur **le fichier d'exemple fourni**. Structure attendue :

| Col | En-tête | Contenu |
|---|---|---|
| A | Désignation | libellé extrait |
| B | Qté | quantité extraite |
| C | Prix unitaire | **laissé vide** à la génération (saisi ensuite) |
| D | Montant | **formule** `=B{n}*C{n}` |
| — | Total | **formule** `=SUM(D2:D{dernier})` |

**Non négociable :**
- Montant et Total sont de **vraies formules Excel**, jamais des valeurs figées → tout se recalcule seul quand on change un prix, y compris dans le fichier téléchargé.
- Format monétaire adapté (devise **FCFA / XOF** — voir l'exemple), ex. `#,##0 "FCFA"`.
- En-têtes en gras aux **couleurs de la charte**, logo en tête de feuille si l'exemple le fait.
- Lignes lisibles, colonnes dimensionnées, bordures légères.

---

## 7. Interface — exigence : rendu professionnel

L'UI doit paraître **soignée et pro** (livrable client). Directives :

- **Identité visuelle** : logo dans le header, couleurs **exclusivement** issues de la charte fournie, typographie cohérente, espacements généreux et réguliers.
- **Zone d'upload** : glisser-déposer + bouton, accepte `.docx`, `.pdf`, images. Aperçu du fichier. Formats non supportés → message clair.
- **États explicites** : repos → envoi → analyse en cours (loader) → résultats → erreur. Jamais d'écran figé sans retour visuel.
- **Tableau de résultats éditable** : colonnes Désignation, Qté, Prix unitaire (champ de saisie), Montant (**calculé en direct** = Qté × Prix), et Total mis à jour en temps réel. Désignation et Qté restent corrigeables (l'humain valide avant génération).
- **Bouton « Générer / Télécharger l'Excel »** : appelle le backend et récupère le `.xlsx`.
- Gestion propre des erreurs, responsive, accessible.

> Pour les choix esthétiques (typographie, hiérarchie visuelle, composants), applique le skill **frontend-design** afin d'éviter un rendu « template par défaut ».

---

## 8. À FAIRE

- Vraies formules Excel (Montant, Total).
- Sortie Gemini en JSON strict + parsing défensif côté backend.
- Couleurs et logo tirés des assets du dépôt, centralisés dans un thème.
- Clé API via `.env` / variables d'environnement, jamais en dur.
- Logger les tokens consommés (`usage`) pour suivre les coûts.
- Garder l'humain dans la boucle (tableau éditable avant génération).
- Coller au fichier Excel d'exemple pour le format de sortie.

## 9. À NE PAS FAIRE

- ❌ Figer Montant/Total en valeurs → perte du recalcul automatique.
- ❌ Coder un parseur par format → le multimodal gère tout.
- ❌ Committer la clé API ou un fichier `.env`.
- ❌ Inventer une palette : s'en tenir à la charte.
- ❌ Laisser le « raisonnement » (thinking) tourner à fond sur cette tâche simple : le limiter réduit la facture sans perte de qualité.
- ❌ Sur-concevoir : viser d'abord un flux simple qui marche de bout en bout.

---

## 10. Démarrage (à adapter)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # y renseigner GEMINI_API_KEY et DATABASE_URL
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

Voir `backend/.env.example` pour la liste complète des variables.

---

## 11. Ordre de travail suggéré

1. Inspecter les assets (logo, couleurs, Excel d'exemple) et poser le thème.
2. Backend : `/api/extract` (upload → Gemini → JSON), testé sur les 3 formats.
3. Backend : `/api/generate-excel` (openpyxl, formules, format FCFA) calé sur l'exemple.
4. Frontend : upload + états + tableau éditable + calcul live + téléchargement.
5. Finitions UI (charte, responsive, gestion d'erreurs).

---

## 12. Module CLIENTS EXTERNES

Espace public de la plateforme. **Strictement séparé de l'outil interne** : il ne
touche ni à Gemini, ni à openpyxl, ni au code des sections 5 et 6.

### 12.0 Deux entrées, une seule sortie

Sur la page d'envoi, **deux moyens côte à côte** de soumettre une demande :

| Voie | Contenu | Ce qui part sur WhatsApp |
|---|---|---|
| **Gauche** — glisser-déposer | PDF, Word, image | le document **tel quel** |
| **Droite** — champ de saisie | la liste tapée au clavier | un **`.docx` généré** par le serveur |

Le client remplit **l'une OU l'autre**, et il n'y a **qu'un seul bouton
d'envoi**. Si un document est joint, la saisie est simplement désactivée — son
aspect grisé suffit à le dire.

**Texte de l'interface : le strict nécessaire.** L'accroche tient sur une seule
ligne (« Téléversez votre document ou saisissez la liste de vos fournitures,
mais pas les deux à la fois ») et se replie si la largeur manque. Sous la
saisie, une seule consigne — « Une ligne par article » — **en rouge**
(`--alerte`), pour qu'elle ne se lise pas comme une légende décorative. Pas
d'explication du traitement interne : le client n'a pas à savoir ce qu'on fait
du document.

⚠️ Le rouge est la **seule couleur hors charte** du projet, introduite à la
demande expresse. Réservée aux mentions à ne pas manquer : ni fond, ni bordure,
ni bouton.

**Les messages d'erreur sont du texte, pas des blocs.** `.cli-alerte` n'a ni
fond, ni bordure, ni encadré : du rouge (`--alerte`) sur la surface de la carte,
et rien d'autre. Un cadre et un aplat pesaient plus lourd que le message
qu'ils portaient — sur une carte de connexion, ils en occupaient le tiers. La
couleur suffit à distinguer l'erreur du reste. Vaut pour les sept endroits qui
affichent une erreur (connexion, inscription, connexion admin, dépôt, modal
répétiteur, liste des répétiteurs, bouton Google).

**Pourquoi générer un document plutôt que de relayer le texte** : l'entreprise
doit toujours recevoir une **pièce jointe exploitable**, jamais un long message
qui se perd dans une conversation WhatsApp. `backend/app/redaction.py` fabrique
donc un `.docx` portant en tête les coordonnées du soumissionnaire (nom,
téléphone, email, établissement si renseigné), puis la liste.

⚠️ **Aucune analyse à cette étape.** Les lignes sont reprises telles quelles :
seules les puces décoratives (`-`, `*`, `•`) sont retirées. Les **nombres sont
conservés** — « 1. Cahier » comme « 3 ardoises » peuvent porter une quantité, et
la perdre fausserait le devis. L'extraction Gemini reste l'affaire de l'outil
interne, plus tard et de son côté.

### 12.1 Parcours

```
Inscription ──► compte enregistré en base (table clients)
     │
     ▼
Connexion  ──► cookie de session HttpOnly
     │
     ▼
Dépôt d'un document (Word / PDF / image)
     │
     ├──► confirmation affichée au client : « demande bien reçue »
     └──► DOCUMENT TEL QUEL relayé sur WhatsApp au numéro de l'entreprise,
          avec le NOM et le CONTACT du soumissionnaire (+ établissement si renseigné)
                    │
                    ▼
          l'équipe reprend le document et le passe, DE SON CÔTÉ,
          dans l'outil interne (/interne) pour produire l'Excel
```

### 12.2 Persistance — règle stricte

- **Trois tables, et trois seulement** :
  - `clients` : `id, nom_complet, contact, email (unique), etablissement (nullable), mot_de_passe_hash, cree_le` ;
  - `admins` : voir section 13 ;
  - `repetiteurs` : voir section 14.2 — profil durable, lié aux clients.
- ❌ **Les demandes / uploads de listes ne sont PAS enregistrés.** Aucune table de
  commandes, de soumissions ou d'historique. Le document est relayé puis écarté
  de la mémoire. Cette règle n'a pas bougé : le CV d'un répétiteur est une
  **autre chose** — un profil que la personne veut voir publié, pas une demande
  ponctuelle.
- Base **PostgreSQL 17** nommée `cavally`, connexion via `DATABASE_URL`.
  Les tables sont créées au démarrage (`initialiser_base()`). Si la base est
  injoignable, l'outil interne reste utilisable — il n'en dépend pas.

### 12.3 Authentification

**Deux chemins d'entrée, un seul compte.** Le formulaire email + mot de passe
reste le chemin principal ; « Continuer avec Google » est proposé à côté, pour
qui préfère. Les deux aboutissent au même compte et à la même session.

- Mot de passe **jamais en clair** : bcrypt (coût 12) sur un pré-hachage
  SHA-256/base64 — ce pré-hachage évite la troncature de bcrypt à 72 octets.
- Session par **JWT dans un cookie `HttpOnly` + `SameSite=Lax`** : illisible
  depuis le JavaScript de la page (hors de portée d'un XSS) et non envoyé sur
  une requête inter-site. `COOKIE_SECURISE=true` dès que le site est en HTTPS.
- `JWT_SECRET` obligatoire en production. Sans lui, un secret éphémère est
  généré : l'app tourne mais les sessions tombent à chaque redémarrage.
- Connexion refusée → **message identique** que l'email existe ou non, **et
  qu'il ait ou non un mot de passe local**. Un compte ouvert avec Google n'a
  pas d'empreinte : `/api/auth/connexion` le refuse sans jamais le dire.
- Route protégée : dépendance `client_courant`.

#### Connexion Google (`GOOGLE_CLIENT_ID`, facultatif)

`POST /api/auth/google` reçoit le **jeton d'identité** obtenu par le bouton
Google Identity Services et le vérifie côté serveur (`backend/app/google_auth.py`) :
signature contrôlée auprès de Google, émetteur, audience, expiration, et
`email_verified`. **Le jeton n'est jamais cru sur parole** — sans cette
vérification, n'importe qui pourrait en forger un.

Trois cas, dans cet ordre : `google_sub` connu → on retrouve le compte ; email
déjà en compte local → on **rattache** les deux (Google a vérifié l'adresse,
c'est la même personne, et cela évite deux comptes pour une seule adresse) ;
sinon → création.

Colonnes concernées sur `clients` : `google_sub` (unique, nullable),
`mot_de_passe_hash` **nullable**, `contact` **nullable**.

Ce flux ne demande **aucun secret d'application** : seul le `client_id` est
nécessaire, et il n'est pas secret — il est de toute façon visible dans la
page. Il est servi au front par `/api/health` pour ne pas le configurer à deux
endroits. Tant qu'il est vide, le bouton n'apparaît pas et la route répond
proprement : même principe que le relais WhatsApp simulé.

#### Le numéro de téléphone, demandé au bon moment

Google ne fournit pas de numéro. Plutôt que d'imposer un formulaire de plus
juste après la connexion, le numéro est réclamé **au dépôt** — là où il sert,
puisque c'est par lui que l'équipe rappelle. `POST /api/demandes` accepte un
champ `contact` optionnel : si le compte n'en a pas, il devient obligatoire, il
est validé, puis **conservé sur le compte** pour n'être demandé qu'une fois.

### 12.4 Relais WhatsApp

Isolé dans `backend/app/whatsapp.py`, derrière l'interface `RelaisWhatsApp`.
Le reste du code ne connaît que `obtenir_relais()` et `envoyer_demande()`.

| Variable | Rôle |
|---|---|
| `WHATSAPP_TOKEN` | jeton d'accès de l'app Meta |
| `WHATSAPP_PHONE_NUMBER_ID` | numéro expéditeur (WhatsApp Business) |
| `WHATSAPP_DESTINATAIRE` | numéro de l'entreprise, format international sans `+` |
| `WHATSAPP_API_VERSION` / `WHATSAPP_API_URL` | endpoint Graph |

- Tant que les **trois premières** ne sont pas toutes renseignées →
  `RelaisSimule` : l'envoi est **journalisé**, le flux client aboutit
  normalement, rien n'échoue.
- Dès qu'elles le sont → `RelaisCloudAPI` prend le relais, **sans toucher au
  reste du code** : téléversement du média puis envoi d'un message `document`
  dont la légende porte nom / contact / établissement / email.
- Si le relais est **configuré mais échoue** → `502` et message d'erreur au
  client. On ne lui confirme jamais une transmission qui n'a pas eu lieu.

> ⚠️ Contrainte Meta : hors fenêtre de service de 24 h, les messages libres sont
> refusés et un *template* est requis. À valider à la mise en service.

### 12.5 Endpoints

| Méthode | Route | Protégée | Rôle |
|---|---|---|---|
| `POST` | `/api/auth/inscription` | non | crée le client, ouvre la session |
| `POST` | `/api/auth/connexion` | non | ouvre la session |
| `POST` | `/api/auth/google` | non | vérifie le jeton Google, crée ou retrouve le compte |
| `POST` | `/api/auth/deconnexion` | non | efface le cookie |
| `GET` | `/api/auth/moi` | oui | session courante |
| `POST` | `/api/demandes` | oui | relaie un document sur WhatsApp — déposé (`file`) ou rédigé depuis la saisie (`texte`). **Ne stocke rien** |

### 12.6 UI

Mêmes jetons de charte que l'outil interne (`styles/theme.css`), thème clair,
logo intégré. Styles préfixés `.cli-` dans `styles/client.css` pour ne jamais
entrer en collision avec `app.css`.

**Épuré** : sur les pages clients, aucune information superflue. Inscription =
5 champs (établissement explicitement facultatif). Connexion = 2 champs. Dépôt =
deux entrées et un bouton, puis une confirmation.

**Tenir dans un écran.** Accueil, connexion et inscription doivent s'afficher
**sans défilement** sur un portable 1366 × 768. C'est une contrainte de mise en
page, pas un souhait : le rythme vertical (`.cli-auth`, `.cli-corps`,
`.cli-carte`) est calibré pour cela.

⚠️ **La place se prend sur les marges et sur le texte, jamais sur les deux
zones de dépôt.** Elles font la page et restent à ~320 px chacune.

Mesuré à 695 px de hauteur utile, `scrollMax = 0` partout :

| Page | Contenu | Marge |
|---|---|---|
| Accueil | 619 px | 76 px |
| Accueil + champ Téléphone | 650 px | 45 px |
| Connexion | 629 px | 66 px |
| Inscription | 687 px | 8 px |

Le champ Téléphone n'apparaît qu'une fois, pour un compte ouvert avec Google
qui n'a pas encore déposé. Ce jour-là seulement, la saisie passe de 9 à 7
lignes — le reste du temps elle garde toute sa hauteur.

L'inscription ne dispose que de 8 px : **tout ajout de champ ou de ligne de
texte sur ces pages doit être mesuré**, pas estimé.

**Formulaire d'inscription — deux colonnes responsives.** Cinq champs empilés
obligent à dérouler la page sur un écran large alors que la place existe. Le
formulaire porte donc `.cli-formulaire--duo` : une grille
`repeat(2, minmax(0, 1fr))` sur desktop, repliée sur **une seule colonne sous
640 px**. L'adresse email — champ long — occupe la ligne entière via la prop
`large` du composant `Champ` (`.cli-champ--large`), tout comme l'alerte et le
bouton. La coquille passe à `.cli-auth--large` (660 px) pour accueillir la
grille. Les formulaires courts (connexions client et admin) restent en colonne
simple : deux champs ne justifient pas une grille.

**Mot de passe — icône œil.** Le basculement visible/masqué se fait par une
**icône** `Eye` / `EyeOff` (`components/Icons.jsx`) posée dans le champ, jamais
par un libellé « afficher / masquer ». C'est le standard attendu et cela ne
dépend pas de la longueur du mot traduit. L'état reste annoncé aux lecteurs
d'écran par `aria-label` + `aria-pressed`. Le comportement vit dans `Champ.jsx`,
donc il s'applique d'office aux trois formulaires (inscription, connexion
client, connexion admin).

### 12.7 À NE PAS FAIRE

- ❌ Relier le dépôt client à l'extraction Gemini ou à la génération Excel.
- ❌ Relayer la liste saisie sous forme de message texte : l'entreprise doit
  recevoir une pièce jointe, pas un pavé dans une conversation.
- ❌ « Nettoyer » la saisie en retirant les nombres en tête de ligne : ce sont
  peut-être des quantités.
- ❌ Créer une table de demandes / commandes / historique d'uploads.
- ❌ Stocker le document du client sur disque ou en base.
- ❌ Confirmer au client une transmission WhatsApp qui a échoué.
- ❌ Exposer l'empreinte du mot de passe dans une réponse d'API.

---

## 13. Protection de l'OUTIL INTERNE (admins)

L'outil interne n'est **pas** ouvert : il exige une session administrateur.
Cette couche s'ajoute **par-dessus** le pipeline Gemini/Excel, dont la logique
métier n'a pas bougé.

### 13.1 Table `admins`

`id, email (unique, identifiant de connexion), nom, mot_de_passe_hash, cree_le,
derniere_connexion`. Distincte de `clients` : un compte client n'est jamais un
compte admin, et réciproquement.

### 13.2 Création du premier admin — hors du web

❌ **Aucune page ni route d'inscription admin.** Les comptes se créent en ligne
de commande uniquement :

```bash
cd backend
python -m app.creer_admin --email chef@cavally.ci --nom "Chef d'équipe"
# mot de passe demandé à la saisie (masquée)

# ou sans interaction, via l'environnement :
ADMIN_EMAIL=... ADMIN_NOM=... ADMIN_MOT_DE_PASSE=... python -m app.creer_admin

# remplacer le mot de passe d'un admin existant :
python -m app.creer_admin --email chef@cavally.ci --nom "Chef" --forcer
```

### 13.3 Cloisonnement des sessions

Deux mécanismes, cumulés :

1. **Deux cookies distincts** — `cavally_session` (client) et `cavally_admin`
   (admin). Ils ne se recouvrent jamais.
2. **Le rôle est scellé dans le JWT** (`role: "client" | "admin"`) et vérifié à
   chaque requête. Renommer un cookie client en `cavally_admin` ne suffit donc
   pas : le rôle du jeton est contrôlé et l'accès refusé.

Le cloisonnement joue **dans les deux sens** : un admin n'accède pas non plus
aux routes de l'espace clients.

### 13.4 Ce qui est protégé

| Route | Accès |
|---|---|
| `POST /api/process` | **admin uniquement** (dépendance `admin_courant`) |
| `GET /api/health?probe=1` | **admin uniquement** — la sonde consomme des tokens Gemini |
| `GET /api/health` | public (aucun secret : état, formats, drapeaux) |
| `POST /api/admin/connexion` | public |
| `POST /api/admin/deconnexion`, `GET /api/admin/moi` | admin |

Côté interface, `/interne` est derrière `RouteAdmin` et redirige vers
`/interne/connexion`. **Ce garde-fou n'est qu'un confort** : le contrôle qui
fait autorité est la dépendance backend. Forcer l'affichage ne permet de
générer aucun devis.

**Matrice vérifiée sur l'API en marche** (pas seulement à la lecture du code) :

| Appelant | `POST /api/process` | `?probe=1` | `/api/admin/moi` | `/api/auth/moi` |
|---|---|---|---|---|
| visiteur anonyme | 401 | 401 | 401 | 401 |
| client externe connecté | 401 | 401 | 401 | 200 |
| jeton client renommé en `cavally_admin` | **401** | — | — | — |
| admin authentifié | passe (415/422 selon le fichier) | 200 | 200 | **401** |

La troisième ligne est celle qui compte : renommer le cookie ne suffit pas,
c'est le `role` scellé dans le JWT qui est vérifié. La dernière ligne montre le
cloisonnement inverse — un admin n'entre pas dans l'espace clients.

### 13.5 À NE PAS FAIRE

- ❌ Ouvrir une route d'inscription admin accessible publiquement.
- ❌ Se contenter de masquer l'UI : le contrôle doit être côté backend.
- ❌ Partager un même cookie ou un même jeton entre client et admin.
- ❌ Modifier le pipeline Gemini/Excel pour ajouter l'autorisation : elle
  s'ajoute en dépendance de route, le métier reste intact.

---

## 14. NAVIGATION PUBLIQUE — Accueil / Témoignage / Répétiteur

### 14.1 La navbar et le principe d'accès

Trois menus, dans `client/Coquille.jsx` (`CoquillePublique`) :

| Menu | Route | Contenu |
|---|---|---|
| **Accueil** | `/` | le dépôt d'une liste — l'espace clients d'origine |
| **Témoignage** | `/temoignages` | grille de vidéos de témoignages |
| **Répétiteur** | `/repetiteurs` | CV des encadreurs + enregistrement |

**Règle d'accès, la même partout : la page est publique, et rien ne barre la
route avant le geste lui-même.**

Sur l'accueil, un visiteur voit la zone de dépôt, choisit son document et clique
sur « Envoyer » — **c'est seulement là** que la session est vérifiée, et
l'invitation à s'identifier (`AppelConnexion`) apparaît sous le bouton. Aucun
message d'entrée, aucune redirection : afficher « réservé aux titulaires d'un
compte » avant même que la personne ait tenté quoi que ce soit est bloquant pour
rien.

Le lien porte `?retour=` pour ramener l'utilisateur d'où il vient une fois
identifié. `destinationRetour()` (`client/navigation.js`) **borne cette valeur
aux chemins internes** : un `//exemple.com` serait lu par le navigateur comme
une URL absolue et transformerait notre page de connexion en redirection
ouverte.

Un `401` renvoyé en cours de route (session expirée entre le choix du fichier et
l'envoi) déclenche exactement la même invitation.

`/depot` redirige vers `/` — l'ancienne adresse continue de fonctionner.
Les pages d'authentification gardent la coquille `CoquilleAuth`, sans navbar :
sur une page de connexion, on ne propose qu'une chose à la fois.

En dessous de **860 px**, la navbar passe sous le logo, sur toute la largeur.

### 14.2 Répétiteurs — table, relation et stockage du CV

**Table `repetiteurs`** :

| Colonne | Rôle |
|---|---|
| `client_id` | FK vers `clients`, **`unique`** + `ON DELETE CASCADE` |
| `nom` | saisi au formulaire, peut différer du nom du compte |
| `cv_fichier` | nom **sur disque**, tiré au sort — jamais celui du client |
| `cv_nom_origine` | nom d'origine, pour l'affichage et le téléchargement |
| `cv_octets`, `cree_le`, `maj_le` | métadonnées |

**Relation simple : un client ↔ au plus un profil.** Un client *peut* être
répétiteur, ou non. L'unicité est portée par la base (index unique sur
`client_id`), pas seulement par le code : se réenregistrer **remplace** le
profil au lieu de créer un doublon, et l'ancien CV est effacé du disque —
mais seulement une fois le remplacement acté en base.

**Stockage du CV** — `backend/app/stockage.py`, dossier réglé par `STOCKAGE_CV`
(défaut `backend/stockage/cv`, ignoré par git). C'est le **seul** stockage de
fichiers de la plateforme. Deux précautions :

1. le nom du fichier est tiré au sort (`secrets.token_hex`), seule l'extension
   validée est reprise — un client ne peut ni écrire ailleurs, ni deviner le
   nom du CV d'un autre ;
2. la relecture est bornée au dossier de stockage (`chemin_cv` vérifie que le
   chemin résolu reste sous la racine).

Formats acceptés : `.pdf`, `.docx`, `.doc`.

### 14.3 Endpoints répétiteurs

| Méthode | Route | Protégée | Rôle |
|---|---|---|---|
| `GET` | `/api/repetiteurs` | non | liste publique des profils |
| `GET` | `/api/repetiteurs/{id}/cv` | non | sert le CV (`inline`) |
| `GET` | `/api/repetiteurs/moi` | **client** | profil du connecté, ou `null` |
| `POST` | `/api/repetiteurs` | **client** | crée ou remplace son profil |

### 14.4 Témoignages — source configurable, pas de base

`client/temoignages.js` exporte un simple tableau. **Aucune table** pour ce
menu. Chaque entrée accepte soit un fichier déposé dans `frontend/public/videos/`,
soit une URL d'intégration YouTube/Vimeo — `estIntegration()` choisit entre
`<video>` et `<iframe>`. Tant que `video` est vide, la carte affiche proprement
« Vidéo à venir » : la grille reste lisible avant même qu'il y ait des vidéos.

### 14.5 À NE PAS FAIRE

- ❌ Enregistrer les dépôts de listes : la règle de la section 12.2 tient
  toujours. Seul le CV du répétiteur est conservé.
- ❌ Créer une table pour les témoignages : un fichier de configuration suffit.
- ❌ Faire confiance au nom de fichier envoyé par le client pour écrire sur
  disque.
- ❌ Rediriger un visiteur non connecté hors des pages publiques, ou lui
  annoncer d'entrée que l'action est réservée : on lui montre la page, on le
  laisse aller jusqu'au geste, et **c'est là** qu'on lui propose de s'identifier.
- ❌ Croire un jeton Google sans en vérifier la signature côté serveur.
- ❌ Laisser transparaître qu'un compte a été ouvert avec Google : la connexion
  par mot de passe renvoie le même message que pour un email inconnu.
