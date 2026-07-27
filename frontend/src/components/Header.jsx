import { NavLink } from 'react-router-dom'

import logo from '../assets/logo-cavally-livres.png'
import { useAdmin } from '../admin/AdminContext.jsx'

/** Les pages de l'outil interne. */
const MENUS = [
  // `end` : sans lui, « Devis » resterait allumé sur /interne/repetiteurs.
  { to: '/interne', libelle: 'Devis', exact: true },
  { to: '/interne/repetiteurs', libelle: 'Répétiteurs' },
]

/** `sante` n'est passé que par l'écran de devis : ailleurs, l'état du modèle
 *  Gemini n'apprend rien. */
export default function Header({ sante }) {
  const { admin, deconnecter } = useAdmin()
  const enLigne = Boolean(sante)

  return (
    <header className="entete">
      <div className="entete__inner">
        <div className="marque">
          <img className="marque__logo" src={logo} alt="Cavally Livres" width="758" height="240" />
          <span className="marque__filet" aria-hidden="true" />
          <span className="marque__produit">
            Devis fournitures
            <span className="marque__produit-note">Outil interne</span>
          </span>
        </div>

        {admin && (
          <nav className="entete__nav" aria-label="Navigation de l'outil interne">
            {MENUS.map((menu) => (
              <NavLink
                key={menu.to}
                to={menu.to}
                end={menu.exact}
                className={({ isActive }) =>
                  isActive ? 'entete__lien est-actif' : 'entete__lien'
                }
              >
                {menu.libelle}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="entete__droite">
          {sante !== undefined && (
            <div
              className={`statut ${enLigne ? 'statut--ok' : 'statut--hs'}`}
              title={enLigne ? `Modèle : ${sante.model}` : "Le service d'analyse ne répond pas"}
            >
              <span className="statut__point" aria-hidden="true" />
              <span className="statut__texte">
                {enLigne ? 'Service opérationnel' : 'Service indisponible'}
              </span>
              {enLigne && <span className="statut__modele">{sante.model}</span>}
            </div>
          )}

          {admin && (
            <div className="entete__admin">
              <span className="entete__admin-nom" title={admin.email}>
                {admin.nom}
              </span>
              <button type="button" className="cli-lien-discret" onClick={deconnecter}>
                Se déconnecter
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
