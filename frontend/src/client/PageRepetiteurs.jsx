import { useCallback, useEffect, useState } from 'react'

import { Sheet } from '../components/Icons.jsx'
import { listerRepetiteurs, monProfilRepetiteur, urlApi } from './api.js'
import AppelConnexion from './AppelConnexion.jsx'
import { useAuth } from './AuthContext.jsx'
import { CoquillePublique } from './Coquille.jsx'
import ModalRepetiteur from './ModalRepetiteur.jsx'

/** Initiales du nom — repère visuel sobre, à défaut de photo. */
function initiales(nom = '') {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0].toUpperCase())
    .join('')
}

export default function PageRepetiteurs() {
  const { client } = useAuth()

  const [profils, setProfils] = useState(null) // null tant que le chargement dure
  const [mien, setMien] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [modalOuvert, setModalOuvert] = useState(false)

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

  // Sait-on déjà si ce client est répétiteur ? Change le libellé du bouton.
  useEffect(() => {
    let actif = true
    if (!client) {
      setMien(null)
      return undefined
    }
    monProfilRepetiteur()
      .then((profil) => actif && setMien(profil))
      .catch(() => actif && setMien(null))
    return () => {
      actif = false
    }
  }, [client])

  // Référence stable : le modal la met en dépendance de son écouteur clavier.
  const fermer = useCallback(() => setModalOuvert(false), [])

  const apresEnregistrement = useCallback(
    (profil) => {
      setMien(profil)
      setModalOuvert(false)
      charger()
    },
    [charger],
  )

  return (
    <CoquillePublique large>
      <header className="cli-section">
        <h1 className="cli-section__titre">Répétiteur</h1>
        <p className="cli-section__chapo">
          Les encadreurs enregistrés auprès de Cavally Livres. Consultez leur CV.
        </p>

        {client ? (
          <button
            type="button"
            className="bouton bouton--primaire"
            onClick={() => setModalOuvert(true)}
          >
            {mien ? 'Mettre à jour mon CV' : "S'enregistrer en tant que répétiteur"}
          </button>
        ) : (
          <AppelConnexion texte="Vous êtes répétiteur ? Identifiez-vous pour déposer votre CV." />
        )}
      </header>

      {erreur && (
        <p className="cli-alerte" role="alert">
          {erreur}
        </p>
      )}

      {profils === null ? (
        <p className="cli-vide">Chargement…</p>
      ) : profils.length === 0 ? (
        <p className="cli-vide">Aucun répétiteur enregistré pour le moment.</p>
      ) : (
        <ul className="rep-grille">
          {profils.map((profil) => (
            <li key={profil.id} className="rep-carte">
              <span className="rep-carte__initiales" aria-hidden="true">
                {initiales(profil.nom)}
              </span>
              <div className="rep-carte__identite">
                <p className="rep-carte__nom">{profil.nom}</p>
                {profil.etablissement && (
                  <p className="rep-carte__etab">{profil.etablissement}</p>
                )}
              </div>
              <a
                className="rep-carte__cv"
                href={urlApi(profil.cv_url)}
                target="_blank"
                rel="noreferrer"
              >
                <Sheet />
                Voir le CV
              </a>
            </li>
          ))}
        </ul>
      )}

      {modalOuvert && client && (
        <ModalRepetiteur
          nomInitial={mien?.nom || client.nom_complet}
          dejaInscrit={Boolean(mien)}
          onFerme={fermer}
          onEnregistre={apresEnregistrement}
        />
      )}
    </CoquillePublique>
  )
}
