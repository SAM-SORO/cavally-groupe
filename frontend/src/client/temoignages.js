/**
 * Source des témoignages vidéo — page « Témoignage ».
 *
 * Volontairement un simple fichier : pas de table en base pour ce menu. Pour
 * publier un témoignage, ajoutez une entrée ci-dessous et renseignez `video`.
 *
 * `video` accepte deux formes :
 *
 *   1. un fichier hébergé avec le site — déposez-le dans `frontend/public/videos/`
 *      et pointez dessus :        video: '/videos/mme-kouassi.mp4'
 *   2. une URL d'intégration YouTube ou Vimeo :
 *                                 video: 'https://www.youtube.com/embed/XXXXXXXXXXX'
 *      (l'URL « embed », pas celle de la barre d'adresse)
 *
 * `poster` est facultatif : une image d'aperçu affichée avant lecture, utile
 * pour les fichiers hébergés. Tant que `video` est vide, la carte affiche
 * proprement « Vidéo à venir » — la grille reste lisible.
 */

export const TEMOIGNAGES = [
  {
    id: 'temoignage-1',
    personne: 'Nom du parent ou du responsable',
    role: 'Établissement ou fonction',
    video: '',
    poster: '',
  },
  {
    id: 'temoignage-2',
    personne: 'Nom du parent ou du responsable',
    role: 'Établissement ou fonction',
    video: '',
    poster: '',
  },
  {
    id: 'temoignage-3',
    personne: 'Nom du parent ou du responsable',
    role: 'Établissement ou fonction',
    video: '',
    poster: '',
  },
]

/** Une URL d'intégration se joue dans une iframe, un fichier dans <video>. */
export function estIntegration(url = '') {
  return /(?:youtube\.com\/embed|youtube-nocookie\.com\/embed|player\.vimeo\.com)/.test(url)
}
