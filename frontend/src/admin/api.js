/**
 * Client HTTP de l'espace administrateur.
 *
 * Session portée par un cookie HttpOnly distinct de celui des clients
 * (`cavally_admin`), avec un rôle scellé dans le jeton côté serveur.
 */

const BASE = import.meta.env.VITE_API_BASE ?? ''

export class ErreurApi extends Error {
  constructor(message, statut) {
    super(message)
    this.statut = statut
  }
}

async function appeler(chemin, { methode = 'GET', corps, json = true } = {}) {
  const options = { method: methode, credentials: 'include' }
  if (corps !== undefined) {
    options.headers = { 'Content-Type': 'application/json' }
    options.body = JSON.stringify(corps)
  }

  let reponse
  try {
    reponse = await fetch(`${BASE}${chemin}`, options)
  } catch {
    throw new ErreurApi('Le serveur est injoignable. Vérifiez que le backend est démarré.', 0)
  }

  if (!reponse.ok) {
    let message = 'Une erreur est survenue.'
    try {
      const detail = (await reponse.json())?.detail
      if (typeof detail === 'string') message = detail
      else if (Array.isArray(detail) && detail.length) {
        message = detail[0]?.msg?.replace(/^Value error,\s*/, '') ?? message
      }
    } catch {
      /* réponse non JSON */
    }
    throw new ErreurApi(message, reponse.status)
  }
  if (reponse.status === 204 || !json) return null
  return reponse.json()
}

export const connecterAdmin = (email, motDePasse) =>
  appeler('/api/admin/connexion', { methode: 'POST', corps: { email, mot_de_passe: motDePasse } })

export const deconnecterAdmin = () =>
  appeler('/api/admin/deconnexion', { methode: 'POST', json: false })

export const recupererAdmin = () => appeler('/api/admin/moi')
