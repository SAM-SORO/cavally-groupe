import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'

import logo from '../assets/logo-cavally-livres.png'
import { useAdmin } from '../admin/AdminContext.jsx'
import { Close, Menu } from './Icons.jsx'

/** Les pages de l'outil interne. */
const MENUS = [
  // `end` : sans lui, « Devis » resterait allumé sur /interne/repetiteurs.
  { to: '/interne', libelle: 'Devis', exact: true },
  { to: '/interne/repetiteurs', libelle: 'Répétiteurs' },
]

/**
 * En-tête de l'outil interne.
 *
 * `sante` n'est passé que par l'écran de devis : ailleurs, l'état du modèle
 * Gemini n'apprend rien.
 *
 * Sur écran étroit, la navigation, l'état du service et le compte ne tiennent
 * plus sur une ligne — ils se chevauchaient. Ils passent alors dans un menu
 * déroulant, ouvert par le bouton à trois traits.
 */
export default function Header({ sante }) {
  const { admin, deconnecter } = useAdmin()
  const enLigne = Boolean(sante)

  const [menuOuvert, setMenuOuvert] = useState(false)
  const entete = useRef(null)

  useEffect(() => {
    if (!menuOuvert) return undefined

    const auClavier = (evenement) => {
      if (evenement.key === 'Escape') setMenuOuvert(false)
    }
    // Un clic hors de l'en-tête referme : comportement attendu d'un déroulant.
    const auClic = (evenement) => {
      if (entete.current && !entete.current.contains(evenement.target)) setMenuOuvert(false)
    }

    document.addEventListener('keydown', auClavier)
    document.addEventListener('mousedown', auClic)
    return () => {
      document.removeEventListener('keydown', auClavier)
      document.removeEventListener('mousedown', auClic)
    }
  }, [menuOuvert])

  const fermer = () => setMenuOuvert(false)

  return (
    <header className="entete" ref={entete}>
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
          <button
            type="button"
            className="entete__burger"
            onClick={() => setMenuOuvert((ouvert) => !ouvert)}
            aria-expanded={menuOuvert}
            aria-controls="menu-interne"
            aria-label={menuOuvert ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {menuOuvert ? <Close /> : <Menu />}
          </button>
        )}

        {/* Un seul balisage : en ligne sur grand écran, déroulant en dessous. */}
        <div
          className={menuOuvert ? 'entete__menu est-ouvert' : 'entete__menu'}
          id="menu-interne"
        >
          {admin && (
            <nav className="entete__nav" aria-label="Navigation de l'outil interne">
              {MENUS.map((menu) => (
                <NavLink
                  key={menu.to}
                  to={menu.to}
                  end={menu.exact}
                  onClick={fermer}
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
                <button
                  type="button"
                  className="cli-lien-discret"
                  onClick={() => {
                    fermer()
                    deconnecter()
                  }}
                >
                  Se déconnecter
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
