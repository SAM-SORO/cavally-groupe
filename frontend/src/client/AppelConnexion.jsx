import { Link } from 'react-router-dom'

/**
 * Invitation à ouvrir une session, posée là où une action est réservée aux
 * inscrits. Les pages, elles, restent consultables sans compte — on ne cache
 * rien, on demande seulement de s'identifier pour agir.
 */
export default function AppelConnexion({ texte }) {
  return (
    <div className="cli-appel">
      <p className="cli-appel__texte">{texte}</p>
      <div className="cli-appel__actions">
        <Link to="/connexion" className="bouton bouton--discret">
          Se connecter
        </Link>
        <Link to="/inscription" className="bouton bouton--primaire">
          Créer un compte
        </Link>
      </div>
    </div>
  )
}
