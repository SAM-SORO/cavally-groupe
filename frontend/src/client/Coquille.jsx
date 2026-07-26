import { Link, NavLink } from 'react-router-dom'

import logo from '../assets/logo-cavally-livres.png'
import { useAuth } from './AuthContext.jsx'

/** Les trois entrées de la navigation publique. */
const MENUS = [
  // `exact` : sans lui, « Accueil » resterait allumé sur toutes les pages.
  { to: '/', libelle: 'Accueil', exact: true },
  { to: '/temoignages', libelle: 'Témoignage' },
  { to: '/repetiteurs', libelle: 'Répétiteur' },
]

/**
 * Enveloppe des pages d'inscription et de connexion : logo, puis la carte.
 * `large` élargit la coquille pour les formulaires disposés en deux colonnes.
 *
 * Volontairement sans navbar : sur une page d'authentification, on ne propose
 * qu'une chose à la fois. Le logo ramène à l'accueil.
 */
export function CoquilleAuth({ children, large = false }) {
  return (
    <div className="cli-page cli-page--auth">
      <main className={large ? 'cli-auth cli-auth--large' : 'cli-auth'}>
        <Link to="/" className="cli-auth__marque" aria-label="Cavally Livres">
          <img src={logo} alt="Cavally Livres" width="758" height="240" />
        </Link>
        {children}
      </main>
    </div>
  )
}

/**
 * Enveloppe des trois pages publiques : navbar, puis le contenu.
 *
 * Les pages sont consultables sans compte ; ce sont les **actions** — déposer
 * une liste, enregistrer son CV — qui exigent une session. La zone de compte
 * bascule donc entre « se connecter / créer un compte » et l'identité.
 *
 * `large` élargit le contenu pour les pages en grille (vidéos, CV).
 */
export function CoquillePublique({ children, large = false }) {
  const { client, deconnecter } = useAuth()

  return (
    <div className="cli-page">
      <header className="cli-entete">
        <div className="cli-entete__inner">
          <Link to="/" className="cli-entete__marque" aria-label="Cavally Livres — accueil">
            <img src={logo} alt="Cavally Livres" width="758" height="240" />
          </Link>

          <nav className="cli-nav" aria-label="Navigation principale">
            {MENUS.map((menu) => (
              <NavLink
                key={menu.to}
                to={menu.to}
                end={menu.exact}
                className={({ isActive }) =>
                  isActive ? 'cli-nav__lien est-actif' : 'cli-nav__lien'
                }
              >
                {menu.libelle}
              </NavLink>
            ))}
          </nav>

          <div className="cli-compte">
            {client ? (
              <>
                <span className="cli-compte__identite">
                  <span className="cli-compte__nom">{client.nom_complet}</span>
                  {client.etablissement && (
                    <span className="cli-compte__etab">{client.etablissement}</span>
                  )}
                </span>
                <button type="button" className="cli-lien-discret" onClick={deconnecter}>
                  Se déconnecter
                </button>
              </>
            ) : (
              <>
                <Link to="/connexion" className="cli-lien-discret">
                  Se connecter
                </Link>
                <Link to="/inscription" className="bouton bouton--primaire cli-bouton-nav">
                  Créer un compte
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className={large ? 'cli-corps cli-corps--large' : 'cli-corps'}>{children}</main>
    </div>
  )
}
