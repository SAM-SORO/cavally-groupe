import { useEffect } from 'react'

/**
 * Coller un document au clavier — Ctrl+V, typiquement une capture d'écran.
 *
 * On écoute l'évènement `paste`, qui **ne demande aucune permission** : le
 * navigateur livre le contenu parce que l'utilisateur a fait le geste. C'est
 * la lecture programmatique (`navigator.clipboard.read()`) qui exigerait une
 * autorisation — on ne s'en sert pas.
 */

const SUFFIXE_PAR_TYPE = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'application/pdf': '.pdf',
}

/**
 * Une capture collée arrive souvent sans nom exploitable — parfois `image.png`,
 * parfois rien du tout. Or tout le reste de l'application décide du format à
 * partir de l'extension : sans nom, le fichier serait refusé à tort.
 */
export function normaliserFichierColle(fichier) {
  const nom = fichier.name || ''
  if (nom.includes('.') && !nom.startsWith('.')) return fichier

  const type = fichier.type || 'image/png'
  const suffixe = SUFFIXE_PAR_TYPE[type] ?? '.png'
  const horodatage = new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[:T]/g, '-')

  return new File([fichier], `capture-${horodatage}${suffixe}`, {
    type,
    lastModified: Date.now(),
  })
}

/**
 * Appelle `onFichier` quand l'utilisateur colle un fichier dans la page.
 *
 * Un collage de **texte** est ignoré : `clipboardData.files` est alors vide,
 * et la saisie libre de l'accueil continue de fonctionner normalement.
 *
 * `actif` permet de couper l'écoute pendant un envoi.
 */
export function useCollageFichier(onFichier, actif = true) {
  useEffect(() => {
    if (!actif) return undefined

    const auCollage = (evenement) => {
      const fichiers = Array.from(evenement.clipboardData?.files || [])
      if (fichiers.length === 0) return

      evenement.preventDefault()
      onFichier(normaliserFichierColle(fichiers[0]))
    }

    document.addEventListener('paste', auCollage)
    return () => document.removeEventListener('paste', auCollage)
  }, [onFichier, actif])
}
