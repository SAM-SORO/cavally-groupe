import { Link } from 'react-router-dom'

import logo from '../assets/logo-cavally-livres.png'
import { useAuth } from './AuthContext.jsx'

/** Enveloppe des pages d'inscription et de connexion : logo, puis la carte. */
export function CoquilleAuth({ children }) {
  return (
    <div className="cli-page cli-page--auth">
      <main className="cli-auth">
        <Link to="/" className="cli-auth__marque" aria-label="Cavally Livres">
          <img src={logo} alt="Cavally Livres" width="758" height="240" />
        </Link>
        {children}
      </main>
    </div>
  )
}

/** Enveloppe de l'espace connecté : barre de compte, puis le contenu. */
export function CoquilleClient({ children }) {
  const { client, deconnecter } = useAuth()

  return (
    <div className="cli-page">
      <header className="cli-entete">
        <div className="cli-entete__inner">
          <Link to="/depot" className="cli-entete__marque" aria-label="Cavally Livres">
            <img src={logo} alt="Cavally Livres" width="758" height="240" />
          </Link>

          <div className="cli-compte">
            <span className="cli-compte__identite">
              <span className="cli-compte__nom">{client?.nom_complet}</span>
              {client?.etablissement && (
                <span className="cli-compte__etab">{client.etablissement}</span>
              )}
            </span>
            <button type="button" className="cli-lien-discret" onClick={deconnecter}>
              Se déconnecter
            </button>
          </div>
        </div>
      </header>

      <main className="cli-corps">{children}</main>
    </div>
  )
}
