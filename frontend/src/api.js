/**
 * Client de l'API — un seul appel : le document part, le .xlsx revient.
 * Le récapitulatif d'analyse voyage dans l'en-tête `X-Devis-Meta` (JSON base64).
 */

const BASE = import.meta.env.VITE_API_BASE ?? ''

export const FORMATS_ACCEPTES = ['.pdf', '.docx', '.png', '.jpg', '.jpeg', '.webp', '.heic', '.txt']
export const ACCEPT_ATTR = FORMATS_ACCEPTES.join(',')
export const TAILLE_MAX_MO = 18

function decoderMeta(valeur) {
  if (!valeur) return null
  try {
    const binaire = atob(valeur)
    const octets = Uint8Array.from(binaire, (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder('utf-8').decode(octets))
  } catch {
    return null
  }
}

function nomDepuisDisposition(disposition, secours) {
  if (!disposition) return secours
  const etendu = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (etendu) {
    try {
      return decodeURIComponent(etendu[1])
    } catch {
      /* on retombe sur la forme simple */
    }
  }
  const simple = /filename="([^"]+)"/i.exec(disposition)
  return simple ? simple[1] : secours
}

export function extensionDe(nom = '') {
  const point = nom.lastIndexOf('.')
  return point === -1 ? '' : nom.slice(point).toLowerCase()
}

export function formatSupporte(fichier) {
  return FORMATS_ACCEPTES.includes(extensionDe(fichier?.name))
}

export function formaterTaille(octets = 0) {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`
}

/**
 * Envoie le document et renvoie { blob, url, nomFichier, meta }.
 * Lève une Error dont le message est directement affichable.
 */
export async function genererDevis(fichier, signal) {
  const donnees = new FormData()
  donnees.append('file', fichier)

  let reponse
  try {
    reponse = await fetch(`${BASE}/api/process`, { method: 'POST', body: donnees, signal })
  } catch (erreur) {
    if (erreur?.name === 'AbortError') throw erreur
    throw new Error("Le serveur d'analyse est injoignable. Vérifie que le backend est démarré.")
  }

  if (!reponse.ok) {
    let message = "L'analyse du document a échoué."
    try {
      const corps = await reponse.json()
      if (corps?.detail) message = corps.detail
    } catch {
      /* réponse non JSON : on garde le message générique */
    }
    throw new Error(message)
  }

  const blob = await reponse.blob()
  const meta = decoderMeta(reponse.headers.get('X-Devis-Meta'))
  const nomFichier = nomDepuisDisposition(
    reponse.headers.get('Content-Disposition'),
    meta?.fichier ?? 'devis-fournitures.xlsx',
  )

  return { blob, url: URL.createObjectURL(blob), nomFichier, meta }
}

export async function verifierApi() {
  try {
    const reponse = await fetch(`${BASE}/api/health`)
    if (!reponse.ok) return null
    return await reponse.json()
  } catch {
    return null
  }
}
