import { useCallback, useEffect, useRef, useState } from 'react'

import { FORMATS_ACCEPTES, TAILLE_MAX_MO, formatSupporte, genererDevis, verifierApi } from './api.js'
import Analysis from './components/Analysis.jsx'
import Aside from './components/Aside.jsx'
import Dropzone from './components/Dropzone.jsx'
import Failure from './components/Failure.jsx'
import Header from './components/Header.jsx'
import Result from './components/Result.jsx'
import Stepper from './components/Stepper.jsx'

const ETAPE_DU_STATUT = { repos: 0, pret: 0, analyse: 1, echec: 1, succes: 2 }

const SURTITRE = {
  repos: 'Étape 1 · Document source',
  pret: 'Étape 1 · Document source',
  analyse: 'Étape 2 · Lecture automatique',
  echec: 'Étape 2 · Lecture automatique',
  succes: 'Étape 3 · Devis généré',
}

export default function App() {
  const [statut, setStatut] = useState('repos')
  const [fichier, setFichier] = useState(null)
  const [resultat, setResultat] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [erreurLocale, setErreurLocale] = useState(null)
  const [sante, setSante] = useState(null)

  const controleur = useRef(null)
  const urlCourante = useRef(null)

  useEffect(() => {
    verifierApi().then(setSante)
  }, [])

  const libererUrl = useCallback(() => {
    if (urlCourante.current) {
      URL.revokeObjectURL(urlCourante.current)
      urlCourante.current = null
    }
  }, [])

  useEffect(() => () => libererUrl(), [libererUrl])

  const choisirFichier = useCallback((choisi) => {
    setErreur(null)
    setResultat(null)
    if (!formatSupporte(choisi)) {
      setFichier(choisi)
      setStatut('pret')
      setErreurLocale(`Format non pris en charge. Formats acceptés : ${FORMATS_ACCEPTES.join(', ')}.`)
      return
    }
    if (choisi.size > TAILLE_MAX_MO * 1024 * 1024) {
      setFichier(choisi)
      setStatut('pret')
      setErreurLocale(`Fichier trop volumineux (limite ${TAILLE_MAX_MO} Mo).`)
      return
    }
    setErreurLocale(null)
    setFichier(choisi)
    setStatut('pret')
  }, [])

  const recommencer = useCallback(() => {
    controleur.current?.abort()
    libererUrl()
    setFichier(null)
    setResultat(null)
    setErreur(null)
    setErreurLocale(null)
    setStatut('repos')
  }, [libererUrl])

  const lancer = useCallback(
    async (cible) => {
      const document = cible ?? fichier
      if (!document) return

      libererUrl()
      setResultat(null)
      setErreur(null)
      setStatut('analyse')

      controleur.current = new AbortController()
      try {
        const reponse = await genererDevis(document, controleur.current.signal)
        urlCourante.current = reponse.url
        setResultat(reponse)
        setStatut('succes')
      } catch (exception) {
        if (exception?.name === 'AbortError') return
        setErreur(exception.message)
        setStatut('echec')
      } finally {
        controleur.current = null
      }
    },
    [fichier, libererUrl],
  )

  const annuler = useCallback(() => {
    controleur.current?.abort()
    controleur.current = null
    setStatut('pret')
  }, [])

  const enSaisie = statut === 'repos' || statut === 'pret'

  return (
    <div className="page">
      <Header sante={sante} />

      <main className="corps">
        <div className="corps__grille">
          <section className="atelier">
            <Stepper actif={ETAPE_DU_STATUT[statut]} />

            <p className="atelier__surtitre">{SURTITRE[statut]}</p>

            <div className="atelier__scene" key={statut}>
              {enSaisie && (
                <Dropzone
                  fichier={fichier}
                  erreur={erreurLocale}
                  onFichier={choisirFichier}
                  onEffacer={recommencer}
                  onLancer={() => lancer()}
                />
              )}

              {statut === 'analyse' && <Analysis nomFichier={fichier?.name} onAnnuler={annuler} />}

              {statut === 'succes' && resultat && <Result resultat={resultat} onRecommencer={recommencer} />}

              {statut === 'echec' && (
                <Failure
                  message={erreur}
                  nomFichier={fichier?.name}
                  onReessayer={fichier ? () => lancer(fichier) : null}
                  onRecommencer={recommencer}
                />
              )}
            </div>
          </section>

          <Aside />
        </div>
      </main>

      <footer className="pied">
        <div className="pied__inner">
          <span>Cavally Livres — outil interne de préparation des devis</span>
        </div>
      </footer>
    </div>
  )
}
