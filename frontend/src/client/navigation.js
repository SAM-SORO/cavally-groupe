/**
 * Le paramètre `?retour=` ramène l'utilisateur là où il en était après une
 * connexion — typiquement l'accueil, quand il a voulu envoyer une liste sans
 * être identifié.
 */

/**
 * Destination de retour, **bornée aux chemins internes**.
 *
 * Un `//` en tête serait lu par le navigateur comme une URL absolue
 * (`//exemple.com` = `https://exemple.com`) : accepter la valeur telle quelle
 * offrirait une redirection ouverte depuis notre propre page de connexion.
 */
export function destinationRetour(parametres) {
  const brut = parametres?.get('retour') || '/'
  return brut.startsWith('/') && !brut.startsWith('//') ? brut : '/'
}

/** Construit un lien vers `chemin` qui ramènera ensuite sur `retour`. */
export const avecRetour = (chemin, retour) =>
  retour && retour !== '/' ? `${chemin}?retour=${encodeURIComponent(retour)}` : chemin
