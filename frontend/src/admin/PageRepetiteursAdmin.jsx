import { useCallback, useEffect, useState } from 'react'

import { Close, Sheet, Spinner } from '../components/Icons.jsx'
import Header from '../components/Header.jsx'
import { listerRepetiteurs, supprimerRepetiteur, urlApi } from './api.js'

/** Formateur local : l'outil interne ne dépend pas du module client. */
function formaterTaille(octets = 0) {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`
}

function formaterDate(valeur) {
  if (!valeur) return '—'
  return new Date(valeur).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function PageRepetiteursAdmin() {
  const [profils, setProfils] = useState(null) // null tant que le chargement dure
  const [erreur, setErreur] = useState(null)
  // Id du profil dont la suppression attend confirmation, puis celui en cours.
  const [aConfirmer, setAConfirmer] = useState(null)
  const [suppression, setSuppression] = useState(null)

  const charger = useCallback(async () => {
    try {
      setProfils(await listerRepetiteurs())
      setErreur(null)
    } catch (exception) {
      setProfils([])
      setErreur(exception.message)
    }
  }, [])

  useEffect(() => {
    charger()
  }, [charger])

  const supprimer = async (id) => {
    setErreur(null)
    setSuppression(id)
    try {
      await supprimerRepetiteur(id)
      setProfils((liste) => liste.filter((p) => p.id !== id))
      setAConfirmer(null)
    } catch (exception) {
      setErreur(exception.message)
    } finally {
      setSuppression(null)
    }
  }

  return (
    <div className="page">
      <Header />

      <main className="corps">
        <header className="tdb__entete">
          <div>
            <h1 className="tdb__titre">Répétiteurs</h1>
            <p className="tdb__chapo">
              Les CV déposés par les encadreurs. Le téléphone et l’email n’apparaissent qu’ici.
            </p>
          </div>
          {profils !== null && (
            <span className="tdb__compte">
              {profils.length} profil{profils.length > 1 ? 's' : ''}
            </span>
          )}
        </header>

        {erreur && (
          <p className="cli-alerte" role="alert">
            {erreur}
          </p>
        )}

        {profils === null ? (
          <p className="tdb__vide">Chargement…</p>
        ) : profils.length === 0 ? (
          <p className="tdb__vide">Aucun répétiteur enregistré pour le moment.</p>
        ) : (
          <div className="tdb__cadre">
            <table className="tdb__table">
              <thead>
                <tr>
                  <th scope="col">Répétiteur</th>
                  <th scope="col">Contact</th>
                  <th scope="col">CV</th>
                  <th scope="col">Déposé le</th>
                  <th scope="col">
                    <span className="visuellement-cache">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {profils.map((profil) => (
                  <tr key={profil.id}>
                    <td>
                      <span className="tdb__nom">{profil.nom}</span>
                      {profil.etablissement && (
                        <span className="tdb__secondaire">{profil.etablissement}</span>
                      )}
                    </td>
                    <td>
                      <span className="tdb__contact">{profil.contact || '—'}</span>
                      <span className="tdb__secondaire">{profil.email}</span>
                    </td>
                    <td>
                      <a
                        className="tdb__cv"
                        href={urlApi(profil.cv_url)}
                        target="_blank"
                        rel="noreferrer"
                        title={profil.cv_nom}
                      >
                        <Sheet />
                        Ouvrir
                      </a>
                      <span className="tdb__secondaire">{formaterTaille(profil.cv_octets)}</span>
                    </td>
                    <td>
                      <span className="tdb__date">{formaterDate(profil.cree_le)}</span>
                      {profil.maj_le && (
                        <span className="tdb__secondaire">
                          màj {formaterDate(profil.maj_le)}
                        </span>
                      )}
                    </td>
                    <td className="tdb__actions">
                      {aConfirmer === profil.id ? (
                        // Confirmation posée dans la ligne : on voit ce qu'on
                        // supprime, sans boîte de dialogue du navigateur.
                        <span className="tdb__confirme">
                          <span className="tdb__confirme-texte">Supprimer&nbsp;?</span>
                          <button
                            type="button"
                            className="tdb__bouton tdb__bouton--danger"
                            onClick={() => supprimer(profil.id)}
                            disabled={suppression === profil.id}
                          >
                            {suppression === profil.id ? (
                              <Spinner className="tourne" />
                            ) : (
                              'Oui, supprimer'
                            )}
                          </button>
                          <button
                            type="button"
                            className="tdb__bouton"
                            onClick={() => setAConfirmer(null)}
                            disabled={suppression === profil.id}
                          >
                            Annuler
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="tdb__retirer"
                          onClick={() => setAConfirmer(profil.id)}
                          aria-label={`Supprimer le profil de ${profil.nom}`}
                          title="Supprimer ce profil"
                        >
                          <Close />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="tdb__note">
          Supprimer un profil retire son CV du serveur. Le compte client, lui, reste actif.
        </p>
      </main>

      <footer className="pied">
        <div className="pied__inner">
          <span>Cavally Livres — outil interne</span>
        </div>
      </footer>
    </div>
  )
}
