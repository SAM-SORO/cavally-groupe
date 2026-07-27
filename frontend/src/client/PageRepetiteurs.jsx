import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { Sheet } from '../components/Icons.jsx'
import { listerRepetiteurs, monProfilRepetiteur, urlApi } from './api.js'
import { useAuth } from './AuthContext.jsx'
import { CoquillePublique } from './Coquille.jsx'
import ModalRepetiteur from './ModalRepetiteur.jsx'
import { avecRetour } from './navigation.js'

/** Là où l'on revient après s'être identifié : ici, modal déjà ouvert. */
const RETOUR_DEPOT = '/repetiteurs?deposer=1'

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
  const naviguer = useNavigate()
  const [parametres, setParametres] = useSearchParams()

  const [profils, setProfils] = useState(null) // null tant que le chargement dure
  // `undefined` = on ne sait pas encore, `null` = ce client n'est pas répétiteur.
  const [mien, setMien] = useState(undefined)
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

  // Retour de la connexion : on reprend le dépôt là où il avait été demandé,
  // plutôt que de laisser l'utilisateur recliquer sur le bouton.
  useEffect(() => {
    if (!client || !parametres.has('deposer')) return
    setModalOuvert(true)
    // Le paramètre a joué son rôle : on nettoie l'adresse pour qu'un
    // rafraîchissement ne rouvre pas le modal.
    const suite = new URLSearchParams(parametres)
    suite.delete('deposer')
    setParametres(suite, { replace: true })
  }, [client, parametres, setParametres])

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

  /**
   * Un seul bouton pour tout le parcours : il conduit à la connexion si elle
   * manque, puis ramène ici, modal ouvert. L'utilisateur n'a pas à deviner
   * qu'un compte est nécessaire.
   */
  const soumettre = () => {
    if (!client) {
      naviguer(avecRetour('/connexion', RETOUR_DEPOT))
      return
    }
    setModalOuvert(true)
  }

  return (
    <CoquillePublique large>
      <header className="rep-entete">
        <div className="rep-entete__texte">
          <h1 className="cli-section__titre">Répétiteur</h1>
          <p className="cli-section__chapo">
            Les encadreurs enregistrés auprès de Cavally Livres. Consultez leur CV.
          </p>
        </div>

        <button type="button" className="bouton bouton--primaire" onClick={soumettre}>
          {mien ? 'Mettre à jour mon CV' : 'Soumettre mon CV'}
        </button>
      </header>

      {erreur && (
        <p className="cli-alerte" role="alert">
          {erreur}
        </p>
      )}

      {profils === null ? (
        <p className="rep-vide">Chargement…</p>
      ) : profils.length === 0 ? (
        <div className="rep-vide">
          <p className="rep-vide__titre">Aucun répétiteur pour le moment</p>
          <p className="rep-vide__texte">Les CV déposés apparaîtront ici.</p>
        </div>
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
