import logo from '../assets/logo-cavally-livres.png'
import { useAdmin } from '../admin/AdminContext.jsx'

export default function Header({ sante }) {
  const enLigne = Boolean(sante)
  const { admin, deconnecter } = useAdmin()

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

        <div className="entete__droite">
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
