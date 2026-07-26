import { Link } from 'react-router-dom'

import { avecRetour } from './navigation.js'

/**
 * Invitation à ouvrir une session, posée au moment où l'action la réclame —
 * jamais en barrage à l'entrée d'une page.
 *
 * `retour` ramène l'utilisateur ici même une fois identifié.
 */
export default function AppelConnexion({ texte, retour = '/' }) {
  return (
    <div className="cli-appel" role="alert">
      <p className="cli-appel__texte">{texte}</p>
      <div className="cli-appel__actions">
        <Link to={avecRetour('/connexion', retour)} className="bouton bouton--discret">
          Se connecter
        </Link>
        <Link to={avecRetour('/inscription', retour)} className="bouton bouton--primaire">
          Créer un compte
        </Link>
      </div>
    </div>
  )
}
