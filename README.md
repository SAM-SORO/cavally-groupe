# Cavally Livres — Plateforme de devis

Deux espaces, **volontairement indépendants**.

| Espace | URL | Accès | Ce qu'il fait |
|---|---|---|---|
| **Espace clients** | `/`, `/inscription`, `/connexion`, `/depot` | compte client | inscription, connexion, dépôt d'un document **relayé sur WhatsApp** |
| **Outil interne** | `/interne` | **admin authentifié** | document → Gemini Flash → devis Excel |

⚠️ **Ils ne communiquent pas.** Le dépôt d'un client ne déclenche ni extraction Gemini ni
génération Excel : le document part tel quel sur WhatsApp, et c'est l'équipe qui le repasse
ensuite, de son côté, dans l'outil interne.

## Outil interne — réservé à l'équipe

**Accès fermé.** `/interne` et `POST /api/process` exigent une session administrateur. Un
visiteur anonyme comme un client externe connecté reçoivent `401`, y compris en appelant l'API
directement. Voir *Administrateurs* plus bas pour créer le premier compte.

Analyse une **liste de fournitures scolaires** (Word, PDF, capture ou photo) avec **Gemini
Flash**, et renvoie un **devis Excel structuré** dont la colonne *Prix Unitaire* est laissée
vide et les colonnes *Total* sont de vraies formules.

L'outil ne fait que ça : **uploader un document, télécharger le `.xlsx`**. Aucun tableau
éditable, aucune saisie de prix dans l'interface — les prix sont renseignés à la main dans le
fichier téléchargé.

---

## Démarrage

Deux terminaux.

### 1. Backend (FastAPI)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows  (source .venv/bin/activate sous Unix)
pip install -r requirements.txt
copy .env.example .env          # puis renseigner GEMINI_API_KEY
uvicorn app.main:app --reload --port 8000
```

> ⚠️ Utiliser un **CPython officiel** (python.org / Microsoft Store). Un Python MSYS2/MinGW ne
> trouve pas les roues Windows de `pymupdf` et `pillow`.

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Interface sur <http://localhost:5173>. Vite proxifie `/api` vers `http://127.0.0.1:8000`, donc
aucune configuration CORS n'est nécessaire en développement.

### Variables d'environnement (`backend/.env`)

| Variable | Défaut | Rôle |
|---|---|---|
| `GEMINI_API_KEY` | — | Clé Google AI Studio. **Jamais committée** (`.gitignore`). |
| `GEMINI_MODEL` | `gemini-flash-latest` | Modèle Flash utilisé pour l'extraction. |
| `MAX_UPLOAD_MB` | `18` | Taille maximale d'un document. |
| `CORS_ORIGINS` | `http://localhost:5173,…` | Origines autorisées (utile hors dev). |
| `GOOGLE_CLIENT_ID` | — | Active « Continuer avec Google ». Vide = bouton masqué. |
| `STOCKAGE_CV` | `stockage/cv` | Dossier des CV de répétiteurs (hors dépôt git). |

---

## Flux

```
React (upload seul) ──► POST /api/process ──► Gemini Flash (JSON strict)
                                │
                                ▼
                 { etablissement, classe, articles[…] }
                                │
                                ▼
              openpyxl ──► .xlsx (Prix Unitaire VIDE + formules) ──► téléchargement
```

Un seul appel réseau. Le `.xlsx` revient directement dans le corps de la réponse ; le
récapitulatif d'analyse (nombre d'articles, établissement, tokens, durée) voyage dans l'en-tête
`X-Devis-Meta`, encodé en JSON base64 pour rester ASCII.

### Endpoints

| Méthode | Route | Réponse |
|---|---|---|
| `POST` | `/api/process` | Le `.xlsx` (`Content-Disposition: attachment`) + `X-Devis-Meta` |
| `GET` | `/api/health` | État du service, modèle actif, formats acceptés |
| `GET` | `/api/health?probe=1` | Idem + **appel réel au modèle** et erreur exacte s'il refuse |

La sonde coûte quelques tokens mais c'est le moyen le plus rapide de distinguer un modèle
retiré (404), un quota épuisé (429) et une clé refusée (401/403) :

```bash
curl "http://127.0.0.1:8000/api/health?probe=1"
```

Formats acceptés : `.pdf`, `.docx`, `.png`, `.jpg/.jpeg`, `.webp`, `.heic/.heif`, `.txt`, `.md`.

**Un seul chemin d'extraction** : pas de parseur par format. Le PDF et les images partent en
`inline_data` vers Gemini ; le `.docx` est simplement normalisé en texte (paragraphes + tableaux)
— et si le document ne contient que des images collées, ce sont ces images qui sont envoyées.

---

## Format du fichier généré

`un_exemple.xlsx` fait référence pour la **mise en forme** — c'est l'identité du devis Cavally
Livres. Le **contenu**, lui, vient intégralement du document analysé :

- **Les rubriques sont celles du document.** Aucune nomenclature imposée : si la liste parle de
  « TENUE DE SPORT », « HYGIÈNE » ou « INFORMATIQUE », c'est ce qui apparaît dans la colonne
  *Catégorie*. Une nomenclature courte n'est déduite que si le document n'a aucune rubrique.
- **Un onglet par classe.** Un fascicule couvrant plusieurs niveaux produit un onglet nommé par
  classe, chacun avec son propre tableau et son propre total. Une seule classe → un seul onglet.
- **Les consignes sont celles du document**, ou rien. Aucune consigne par défaut.
- **Une information absente reste une case à compléter** (`_______`), jamais une valeur inventée :
  c'est vrai de l'établissement, de la classe et de l'année scolaire comme des prix unitaires.

Structure de chaque onglet :

```
A1  Établissement                              E1  DEVIS ESTIMATIF
A2  Coordonnées                                E3  Année Scolaire : | F3
A5  Nom de l'élève : | B5  ______              E4  Classe :         | F4
A6  Parent / Tuteur : | B6 ______              E5  Date :           | F5

L9   Catégorie │ Désignation │ Qté │ Prix Unitaire (FCFA) │ Total HT (FCFA)
L10+ …données…       (colonne D vide)            =C{n}*D{n}
L…+2 TOTAL ESTIMATIF HT :                        =SUM(E10:E{dernier})
L…+3 CONSIGNES & REMARQUES : …      (seulement si le document en contient)
```

Règles tenues :

- **Vraies formules** — `Total HT` et `TOTAL ESTIMATIF HT` sont des formules Excel, jamais des
  valeurs figées : tout se recalcule dès qu'un prix est saisi.
- **Prix Unitaire vide** — la cellule porte le format monétaire et les bordures, mais aucune valeur.
- **Format FCFA** — `#,##0 "FCFA"`, comme dans le fichier d'exemple.
- **Couleurs de la charte** — bandeau d'en-tête `#FFB800`, texte noir (contraste conforme), ligne
  de total voilée de jaune, filets gris neutres.
- Volets figés sous les en-têtes, ligne de titre répétée à l'impression, paysage ajusté en largeur.

---

## Charte graphique

Source unique : `code couleur.txt`.

| | Hex | Usage |
|---|---|---|
| Jaune | `#FFB800` | accent, bandeau Excel, bouton principal, jauge d'analyse |
| Noir | `#000000` | texte, boutons secondaires, pastille d'étape active |
| Blanc | `#FFFFFF` | surfaces |

Toutes les autres valeurs sont **dérivées** de ces trois-là et centralisées dans
`frontend/src/styles/theme.css` : les gris sont du noir posé en aplat transparent sur blanc, les
voiles sont du jaune posé en aplat transparent sur blanc, `--brand-press` est le jaune à 90 % de
luminosité. Aucune couleur hors charte n'est introduite.

Le logo est recadré sur son contenu utile (`frontend/src/assets/logo-cavally-livres.png`) et intégré
dans le header. Le favicon reprend la marque du logo.

---

## Structure

```
backend/
  app/
    config.py         lecture du .env (Gemini, base, auth, WhatsApp)
    main.py           API FastAPI : monte les deux espaces

    # — Outil interne —
    schemas.py        modèles Pydantic + nettoyage défensif des libellés/quantités
    extraction.py     prompt, schéma de réponse, appel Gemini, parsing défensif
    excel.py          génération openpyxl (structure de un_exemple.xlsx)

    # — Base et sécurité (communs) —
    db.py             moteur SQLAlchemy, création des tables + petites migrations
    google_auth.py    vérification du jeton d'identité Google (facultatif)
    models.py         tables clients, admins et repetiteurs (les trois seules)
    securite.py       bcrypt, JWT, cookies HttpOnly, rôles client/admin

    # — Espace clients —
    schemas_client.py validation inscription / connexion
    routes_client.py  /api/auth/* et /api/demandes
    redaction.py      liste tapée → .docx (python-docx), sans aucune analyse
    whatsapp.py       relais isolé : RelaisSimule | RelaisCloudAPI

    # — Répétiteurs —
    routes_repetiteurs.py  /api/repetiteurs (liste publique, dépôt fermé)
    stockage.py            écriture des CV sur disque, noms tirés au sort

    # — Administration —
    routes_admin.py   /api/admin/* (connexion, déconnexion, session)
    creer_admin.py    CLI de création d'un admin (aucune inscription web)
  stockage/cv/        CV déposés — hors dépôt git
frontend/
  public/videos/      vidéos de témoignage auto-hébergées (facultatif)
  src/
    main.jsx          routage : public sur /, outil interne sur /interne
    App.jsx           outil interne (machine à états)
    api.js            client HTTP de l'outil interne
    components/       Header, Stepper, Dropzone, Analysis, Result, Failure, Aside, Icons
    client/           AuthContext, Coquille (navbar), Champ, AppelConnexion,
                      ConnexionGoogle, navigation.js (paramètre ?retour=),
                      PageInscription, PageConnexion, PageDepot,
                      PageTemoignages + temoignages.js,
                      PageRepetiteurs + ModalRepetiteur, api.js
    admin/            AdminContext, PageConnexionAdmin, RouteAdmin, api.js
    styles/           theme.css (charte) + app.css (interne) + client.css (clients)
```

### Navigation publique

Trois menus — **Accueil** (`/`, dépôt d'une liste), **Témoignage**
(`/temoignages`), **Répétiteur** (`/repetiteurs`).

Même règle partout : la page est consultable sans compte, et **rien ne barre la route avant le
geste**. Sur l'accueil, un visiteur choisit son document et clique sur « Envoyer » ; c'est
seulement là que la session est vérifiée, et l'invitation à s'identifier apparaît sous le
bouton. Le lien porte `?retour=`, borné aux chemins internes, pour le ramener où il en était.

---

## Espace clients externes

### Deux entrées, une seule sortie

La page d'envoi propose **deux moyens côte à côte** : la zone de glisser-déposer à gauche, un
champ de saisie libre à droite. Le client remplit l'un **ou** l'autre, et un seul bouton envoie.

| Ce que fait le client | Ce que reçoit l'entreprise |
|---|---|
| dépose un PDF | le PDF, tel quel |
| dépose un Word | le Word, tel quel |
| tape sa liste | un **`.docx` généré** par le serveur |

L'entreprise reçoit **toujours une pièce jointe**, jamais un long message texte qui se perdrait
dans la conversation WhatsApp. Le `.docx` (`backend/app/redaction.py`, python-docx) porte en tête
les coordonnées du soumissionnaire, puis la liste.

**Aucune analyse à cette étape** : les lignes sont reprises telles quelles, seules les puces
décoratives (`-`, `*`, `•`) sont retirées. Les nombres en tête de ligne sont **conservés** — ce
sont peut-être des quantités. L'extraction Gemini reste l'affaire de l'outil interne.

Si un document est joint, le champ de saisie est désactivé avec une mention explicite : mieux
vaut le dire que d'ignorer en silence ce qui aurait été tapé.

### Parcours

```
Inscription ──► compte créé dans PostgreSQL (table clients)
     ▼
Connexion   ──► cookie de session HttpOnly
     ▼
Dépôt d'un document (Word / PDF / image)
     ├──► confirmation affichée : « Demande bien reçue »
     └──► DOCUMENT TEL QUEL relayé sur WhatsApp à l'entreprise,
          avec nom + contact (+ établissement si renseigné)
```

### Persistance — règle stricte

**Les dépôts de listes ne sont pas stockés.** Il n'existe aucune table de demandes, de commandes
ou d'historique d'uploads : le document est relayé sur WhatsApp puis écarté de la mémoire, et
rien n'est écrit sur disque.

Table `clients` : `id, nom_complet, contact, email (unique), etablissement (nullable),
mot_de_passe_hash, cree_le`. Créée au démarrage. **Si la base est injoignable, l'outil interne
reste utilisable** — il n'en dépend pas — et l'espace clients répond `503` avec un message clair.

> Le CV d'un répétiteur, lui, **est** conservé (fichier + entrée en base) : c'est un profil que
> la personne veut voir publié, pas une demande ponctuelle. Voir « Répétiteurs » plus bas.

### Authentification

- Mot de passe **jamais en clair** : bcrypt (coût 12) sur un pré-hachage SHA-256/base64. Ce
  pré-hachage évite la troncature silencieuse de bcrypt à 72 octets.
- Session par **JWT dans un cookie `HttpOnly` + `SameSite=Lax`** : illisible depuis le
  JavaScript de la page (donc hors de portée d'un XSS) et non envoyé sur une requête
  inter-site. Passer `COOKIE_SECURISE=true` dès que le site est servi en HTTPS.
- `JWT_SECRET` doit être défini en production. Sans lui, un secret éphémère est généré :
  l'application tourne, mais les sessions tombent à chaque redémarrage.
- Une connexion refusée renvoie **le même message** que l'email existe ou non, et qu'il ait ou
  non un mot de passe local.

### Connexion Google (facultative)

Un bouton « Continuer avec Google » s'ajoute à côté du formulaire, pour qui préfère. Les deux
chemins aboutissent au même compte.

Le navigateur récupère un **jeton d'identité** ; c'est le serveur qui le vérifie
(`backend/app/google_auth.py`) : signature contrôlée auprès de Google, émetteur, audience,
expiration et `email_verified`. Un jeton n'est jamais cru sur parole.

Si l'adresse correspond déjà à un compte local, les deux sont **rattachés** — Google a vérifié
cette adresse, et cela évite deux comptes pour une seule personne. Un compte ouvert avec Google
n'a pas de mot de passe : `/api/auth/connexion` le refuse, sans jamais le dire.

**Activation** — dans Google Cloud Console : *APIs & Services > Credentials > Create credentials
> OAuth client ID*, type « Web application », puis ajouter `http://localhost:5173` (et l'URL de
production) dans *Authorized JavaScript origins*. Reporter le **Client ID** dans
`GOOGLE_CLIENT_ID` (`backend/.env`). Le *Client secret* n'est pas utilisé par ce flux.

Tant que la variable est vide, le bouton n'apparaît pas et la route répond proprement : rien ne
casse. Le client ID n'est pas un secret — il est servi au front par `/api/health` pour ne pas
avoir à le configurer à deux endroits.

### Le numéro de téléphone

Google ne fournit pas de numéro. Plutôt qu'un formulaire de plus juste après la connexion, il
est demandé **au moment du dépôt** — là où il sert, puisque c'est par lui que l'équipe rappelle
— puis conservé sur le compte pour n'être réclamé qu'une fois.

### Relais WhatsApp

Isolé dans `backend/app/whatsapp.py` derrière l'interface `RelaisWhatsApp`. Le reste du code ne
connaît que `obtenir_relais()` et `envoyer_demande()`.

| Variable | Rôle |
|---|---|
| `WHATSAPP_TOKEN` | jeton d'accès de l'application Meta |
| `WHATSAPP_PHONE_NUMBER_ID` | numéro expéditeur (WhatsApp Business) |
| `WHATSAPP_DESTINATAIRE` | numéro de l'entreprise, format international sans `+` |
| `WHATSAPP_API_VERSION`, `WHATSAPP_API_URL` | endpoint Graph |

Trois états :

1. **Non configuré** (aucun identifiant) → `RelaisSimule` : l'envoi est journalisé en `WARNING`
   avec le contenu exact du message, et le flux client aboutit normalement. Rien n'échoue.
2. **Configuré** → `RelaisCloudAPI` : téléversement du média puis envoi d'un message `document`
   dont la légende porte nom / contact / établissement / email. **Aucune autre ligne de code à
   modifier.**
3. **Configuré mais en échec** → `502` et message d'erreur au client. On ne lui confirme jamais
   une transmission qui n'a pas eu lieu.

> ⚠️ Contrainte Meta à valider à la mise en service : hors fenêtre de service de 24 h, les
> messages libres sont refusés et un *template* approuvé est requis.

### Endpoints

| Méthode | Route | Protégée | Rôle |
|---|---|---|---|
| `POST` | `/api/auth/inscription` | non | crée le client, ouvre la session |
| `POST` | `/api/auth/connexion` | non | ouvre la session |
| `POST` | `/api/auth/google` | non | vérifie le jeton Google, crée ou retrouve le compte |
| `POST` | `/api/auth/deconnexion` | non | efface le cookie |
| `GET` | `/api/auth/moi` | oui | session courante |
| `POST` | `/api/demandes` | oui | relaie le document, **ne stocke rien** |

---

## Répétiteurs

Page `/repetiteurs` : les CV des encadreurs, consultables par tous. Le bouton
« S'enregistrer en tant que répétiteur » ouvre un modal (nom + CV) — réservé aux clients
connectés ; un visiteur y voit l'invitation à s'identifier.

### Relation

Un client **peut** être répétiteur, ou non. La table `repetiteurs` porte une clé étrangère
`client_id` **unique** vers `clients`, avec `ON DELETE CASCADE` : un client, au plus un profil.
Se réenregistrer **remplace** le profil au lieu d'en créer un second, et l'ancien CV est effacé
du disque — après que le remplacement soit acté en base, jamais avant.

### Stockage du CV

Dossier réglé par `STOCKAGE_CV` (défaut `backend/stockage/cv`, ignoré par git). C'est le seul
stockage de fichiers de la plateforme. Le nom sur disque est **tiré au sort**
(`secrets.token_hex`) et seule l'extension validée est reprise : le nom envoyé par le client
n'atteint jamais le système de fichiers. La relecture est bornée au dossier de stockage.

Formats acceptés : `.pdf`, `.docx`, `.doc`.

### Endpoints

| Méthode | Route | Protégée | Rôle |
|---|---|---|---|
| `GET` | `/api/repetiteurs` | non | liste publique des profils |
| `GET` | `/api/repetiteurs/{id}/cv` | non | sert le CV (`inline`) |
| `GET` | `/api/repetiteurs/moi` | client | profil du connecté, ou `null` |
| `POST` | `/api/repetiteurs` | client | crée ou remplace son profil |

---

## Témoignages

Page `/temoignages` : une grille de vidéos. **Aucune table** — la source est le fichier
`frontend/src/client/temoignages.js`. Chaque entrée accepte soit un fichier déposé dans
`frontend/public/videos/`, soit une URL d'intégration YouTube ou Vimeo. Tant que `video` est
vide, la carte affiche « Vidéo à venir » : la grille reste lisible avant même qu'il y ait des
vidéos.

---

## Base de données

PostgreSQL 17 local, base `cavally`. À créer une fois :

```bash
psql -U postgres -c "CREATE DATABASE cavally;"
```

Puis renseigner `DATABASE_URL` dans `backend/.env` :

```
DATABASE_URL=postgresql+psycopg://postgres:MOT_DE_PASSE@localhost:5432/cavally
```

Trois tables, créées au démarrage : `clients`, `admins`, `repetiteurs`. Pas de quatrième —
ni demandes, ni commandes, ni historique d'uploads.

---

## Administrateurs

L'outil interne est protégé par une session admin, distincte de celle des clients.

### Créer le premier admin

Il n'existe **aucune page ni route d'inscription admin**. Les comptes se créent uniquement en
ligne de commande :

```bash
cd backend
python -m app.creer_admin --email chef@cavally.ci --nom "Chef d'équipe"
# le mot de passe est demandé à la saisie, masquée, avec confirmation
```

Sans interaction (CI, provisionnement) :

```bash
ADMIN_EMAIL=chef@cavally.ci ADMIN_NOM="Chef d'équipe" ADMIN_MOT_DE_PASSE=... \
  python -m app.creer_admin
```

Remplacer le mot de passe d'un compte existant : ajouter `--forcer`.

La connexion se fait ensuite sur **`/interne/connexion`**.

### Cloisonnement des sessions

Deux mécanismes cumulés, parce qu'un seul ne suffit pas :

1. **Deux cookies distincts** — `cavally_session` (client) et `cavally_admin` (admin).
2. **Le rôle est scellé dans le JWT** (`role: "client" | "admin"`) et vérifié à chaque requête.

Conséquence : renommer un cookie client en `cavally_admin` ne donne aucun accès — le rôle du
jeton est contrôlé et la requête rejetée. Le cloisonnement joue **dans les deux sens** : un
admin n'accède pas non plus aux routes de l'espace clients.

### Ce qui est protégé

| Route | Accès |
|---|---|
| `POST /api/process` | admin uniquement |
| `GET /api/health?probe=1` | admin uniquement — la sonde consomme des tokens Gemini |
| `GET /api/health` | public (aucun secret) |
| `POST /api/admin/connexion` | public |
| `POST /api/admin/deconnexion`, `GET /api/admin/moi` | admin |

Côté interface, `/interne` redirige vers `/interne/connexion` si la session manque. **Ce
garde-fou n'est qu'un confort** : l'autorité est la dépendance backend, forcer l'affichage ne
permet de générer aucun devis.

## Quotas Gemini — à connaître

Le palier gratuit de l'API Gemini est limité à **20 requêtes par jour, par projet et par
modèle** (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`). Une fois atteint, chaque
analyse échoue en `429 RESOURCE_EXHAUSTED`.

Deux pièges :

- **Les alias `-latest` ne sont pas des modèles à part.** `gemini-flash-latest` et
  `gemini-3.6-flash` désignent le même modèle et **partagent le même compteur** : passer de
  l'un à l'autre ne redonne aucun quota.
- **Chaque modèle a son propre compteur.** Basculer sur `gemini-3.5-flash` ou
  `gemini-flash-lite-latest` redonne 20 requêtes — mais ce n'est qu'un répit.

La solution durable est d'**activer la facturation** sur le projet Google AI Studio. Pour
vérifier l'état du quota à un instant donné :

```bash
curl "http://127.0.0.1:8000/api/health?probe=1"
```

## Coûts & journalisation

Le raisonnement du modèle est **bridé** (`thinking_level: low`, ou `thinking_budget: 0` sur les
modèles 2.5) : la tâche est simple et cadrée, cela réduit la facture sans perte de qualité. La
configuration acceptée par le modèle est négociée au premier appel puis mémorisée.

Chaque appel journalise les tokens consommés :

```
Gemini gemini-3.6-flash — 3.95s | tokens prompt=1057 reponse=560 raisonnement=0 total=1617
```

---

## Écarts assumés par rapport à `CLAUDE.md`

1. **Modèle par défaut** — `gemini-2.5-flash` renvoie `404 : no longer available to new users`
   pour cette clé. Le défaut est donc `gemini-flash-latest` : cet alias suit le Flash courant,
   donc il ne retombera pas en 404 le jour où la version datée sera retirée. Conforme à la
   consigne « vérifier le modèle Flash actif ».
2. **Schéma d'extraction élargi** — le prompt demande aussi `categorie`, `etablissement`,
   `annee_scolaire`, `consignes` et un découpage `listes[]` par classe, parce que
   `un_exemple.xlsx` comporte ces blocs et qu'un même document peut couvrir plusieurs niveaux.
   Les règles de fond sont inchangées : un article = une ligne, quantité par défaut à 1, ordre du
   document préservé, rien d'inventé (chaîne vide si l'information est absente).
3. **Colonnes** — l'exemple place la Désignation en **B** et le Montant en **E** (`=C*D`), là où la
   table de `CLAUDE.md` décrivait un tableau A→D. La structure de l'exemple a été suivie.
4. **Pas de logo dans l'Excel** — `CLAUDE.md` le conditionne à « si l'exemple le fait » ; le fichier
   de référence n'en contient pas. Une mention texte « Devis établi par Cavally Livres » ferme le
   document.

---

## Vérifications effectuées

- Extraction réelle testée sur les trois formats (`.docx`, `.pdf`, `.png`) : 18/18 articles,
  quantités et catégories correctes, métadonnées d'en-tête relevées.
- Testé sur un document volontairement éloigné de l'exemple (deux classes dans le même fichier,
  rubriques « TENUE DE SPORT / HYGIÈNE / ARTS PLASTIQUES / GÉOMÉTRIE / INFORMATIQUE », aucune
  consigne, pas d'année scolaire, mise en page en tableau) : 2 onglets nommés par classe, les
  8 rubriques du document restituées telles quelles, année scolaire laissée à compléter, aucun
  bloc consignes fabriqué.
- `POST /api/process` : `200` + `.xlsx` valide en ~4 s ; `415` sur format non supporté ; `422`
  quand le document n'est pas une liste de fournitures.
- Classeur relu avec openpyxl : 18 formules `=C{n}*D{n}`, total `=SUM(E10:E27)`, 18 cellules de prix
  effectivement vides, format `#,##0 "FCFA"`, en-tête `FFFFB800` en gras noir.
- Interface parcourue dans Chrome sur les cinq états (repos, document retenu, analyse, succès, échec).
