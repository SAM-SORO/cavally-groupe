/**
 * Client HTTP de l'espace clients.
 *
 * La session est portée par un cookie HttpOnly posé par le serveur : le
 * JavaScript de la page ne manipule jamais de jeton. D'où `credentials:
 * 'include'` sur chaque appel.
 */

const BASE = import.meta.env.VITE_API_BASE ?? ''

export const FORMATS_CLIENT = ['.pdf', '.docx', '.png', '.jpg', '.jpeg', '.webp', '.heic']
export const ACCEPT_CLIENT = FORMATS_CLIENT.join(',')
export const TAILLE_MAX_MO = 18

// Un CV est un document : ni image, ni tableur. Doit rester aligné sur
// `FORMATS_CV` dans backend/app/stockage.py.
export const FORMATS_CV = ['.pdf', '.docx', '.doc']
export const ACCEPT_CV = FORMATS_CV.join(',')

/** Chemin renvoyé par l'API → URL utilisable dans un lien. */
export const urlApi = (chemin) => `${BASE}${chemin}`

export class ErreurApi extends Error {
  constructor(message, statut) {
    super(message)
    this.statut = statut
  }
}

async function appeler(chemin, { methode = 'GET', corps, json = true } = {}) {
  const options = { method: methode, credentials: 'include' }

  if (corps instanceof FormData) {
    options.body = corps
  } else if (corps !== undefined) {
    options.headers = { 'Content-Type': 'application/json' }
    options.body = JSON.stringify(corps)
  }

  let reponse
  try {
    reponse = await fetch(`${BASE}${chemin}`, options)
  } catch {
    throw new ErreurApi('Le serveur est injoignable. Vérifiez votre connexion.', 0)
  }

  if (!reponse.ok) {
    throw new ErreurApi(await extraireMessage(reponse), reponse.status)
  }
  if (reponse.status === 204 || !json) return null
  return reponse.json()
}

async function extraireMessage(reponse) {
  try {
    const corps = await reponse.json()
    const detail = corps?.detail
    if (typeof detail === 'string') return detail
    // Erreurs de validation Pydantic : on remonte le premier message utile.
    if (Array.isArray(detail) && detail.length) {
      return detail[0]?.msg?.replace(/^Value error,\s*/, '') ?? 'Données invalides.'
    }
  } catch {
    /* réponse non JSON */
  }
  return "Une erreur est survenue. Réessayez dans un instant."
}

export const inscrire = (donnees) =>
  appeler('/api/auth/inscription', { methode: 'POST', corps: donnees })

export const connecter = (email, motDePasse) =>
  appeler('/api/auth/connexion', { methode: 'POST', corps: { email, mot_de_passe: motDePasse } })

export const deconnecter = () =>
  appeler('/api/auth/deconnexion', { methode: 'POST', json: false })

export const recupererSession = () => appeler('/api/auth/moi')

export function deposerDocument(fichier) {
  const donnees = new FormData()
  donnees.append('file', fichier)
  return appeler('/api/demandes', { methode: 'POST', corps: donnees })
}

// — Répétiteurs —

/** Liste publique des profils : consultable sans compte. */
export const listerRepetiteurs = () => appeler('/api/repetiteurs')

/** Profil du client connecté, ou `null` s'il n'est pas répétiteur. */
export const monProfilRepetiteur = () => appeler('/api/repetiteurs/moi')

/** Crée — ou remplace — le profil répétiteur du client connecté. */
export function enregistrerRepetiteur(nom, cv) {
  const donnees = new FormData()
  donnees.append('nom', nom)
  donnees.append('cv', cv)
  return appeler('/api/repetiteurs', { methode: 'POST', corps: donnees })
}

export function extensionDe(nom = '') {
  const point = nom.lastIndexOf('.')
  return point === -1 ? '' : nom.slice(point).toLowerCase()
}

export const formatSupporte = (fichier) => FORMATS_CLIENT.includes(extensionDe(fichier?.name))

export const cvSupporte = (fichier) => FORMATS_CV.includes(extensionDe(fichier?.name))

export function formaterTaille(octets = 0) {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`
}
