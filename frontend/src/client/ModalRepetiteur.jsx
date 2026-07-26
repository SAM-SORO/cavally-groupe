import { useEffect, useRef, useState } from 'react'

import { Close, Spinner, Trombone } from '../components/Icons.jsx'
import {
  ACCEPT_CV,
  FORMATS_CV,
  TAILLE_MAX_MO,
  cvSupporte,
  enregistrerRepetiteur,
  formaterTaille,
} from './api.js'

const SELECTEUR_FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Formulaire d'enregistrement d'un répétiteur, en modal.
 *
 * N'est monté que pour un client connecté — la page s'en assure avant de
 * l'ouvrir, et le backend le revérifie de toute façon.
 */
export default function ModalRepetiteur({ nomInitial = '', dejaInscrit = false, onFerme, onEnregistre }) {
  const [nom, setNom] = useState(nomInitial)
  const [fichier, setFichier] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)

  const dialogue = useRef(null)
  const input = useRef(null)
  const champNom = useRef(null)

  useEffect(() => {
    champNom.current?.focus()

    const auClavier = (evenement) => {
      if (evenement.key === 'Escape') {
        onFerme()
        return
      }
      // Piège à focus : la tabulation ne doit pas repartir dans la page,
      // qui est inerte tant que le modal est ouvert.
      if (evenement.key !== 'Tab') return
      const cibles = dialogue.current?.querySelectorAll(SELECTEUR_FOCUSABLE)
      if (!cibles?.length) return
      const premier = cibles[0]
      const dernier = cibles[cibles.length - 1]
      if (evenement.shiftKey && document.activeElement === premier) {
        evenement.preventDefault()
        dernier.focus()
      } else if (!evenement.shiftKey && document.activeElement === dernier) {
        evenement.preventDefault()
        premier.focus()
      }
    }

    document.addEventListener('keydown', auClavier)
    // Le fond de page ne défile pas derrière le modal.
    const defilement = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', auClavier)
      document.body.style.overflow = defilement
    }
  }, [onFerme])

  const choisir = (liste) => {
    const candidat = liste?.[0]
    if (!candidat) return
    if (!cvSupporte(candidat)) {
      setFichier(null)
      setErreur(`Format non pris en charge. Formats acceptés : ${FORMATS_CV.join(', ')}.`)
      return
    }
    if (candidat.size > TAILLE_MAX_MO * 1024 * 1024) {
      setFichier(null)
      setErreur(`Fichier trop volumineux (limite ${TAILLE_MAX_MO} Mo).`)
      return
    }
    setErreur(null)
    setFichier(candidat)
  }

  const soumettre = async (evenement) => {
    evenement.preventDefault()
    setErreur(null)

    if (!fichier) {
      setErreur('Ajoutez votre CV pour continuer.')
      return
    }

    setEnvoi(true)
    try {
      const profil = await enregistrerRepetiteur(nom.trim(), fichier)
      onEnregistre(profil)
    } catch (exception) {
      setErreur(exception.message)
      setEnvoi(false)
    }
  }

  return (
    <div
      className="cli-voile"
      // Clic sur le fond — mais pas sur le modal lui-même — pour fermer.
      onMouseDown={(evenement) => {
        if (evenement.target === evenement.currentTarget) onFerme()
      }}
    >
      <div
        className="cli-modal"
        ref={dialogue}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-modal-repetiteur"
      >
        <div className="cli-modal__entete">
          <h2 className="cli-modal__titre" id="titre-modal-repetiteur">
            {dejaInscrit ? 'Mettre à jour mon profil' : "S'enregistrer comme répétiteur"}
          </h2>
          <button
            type="button"
            className="cli-modal__fermer"
            onClick={onFerme}
            aria-label="Fermer"
            disabled={envoi}
          >
            <Close />
          </button>
        </div>

        <p className="cli-modal__texte">
          {dejaInscrit
            ? 'Le nouveau CV remplacera celui déjà en ligne.'
            : 'Votre nom et votre CV apparaîtront sur cette page.'}
        </p>

        <form className="cli-formulaire cli-modal__formulaire" onSubmit={soumettre} noValidate>
          <div className="cli-champ">
            <label className="cli-champ__libelle" htmlFor="repetiteur-nom">
              Nom
            </label>
            <div className="cli-champ__boite">
              <input
                id="repetiteur-nom"
                ref={champNom}
                className="cli-champ__saisie"
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Koffi Aya"
                autoComplete="name"
                required
              />
            </div>
          </div>

          <div className="cli-champ">
            <span className="cli-champ__libelle">Curriculum vitæ</span>

            {fichier ? (
              <div className="fiche">
                <div className="fiche__doc">
                  <span className="fiche__badge">
                    {(fichier.name.split('.').pop() || 'DOC').toUpperCase()}
                  </span>
                  <span className="fiche__infos">
                    <span className="fiche__nom" title={fichier.name}>
                      {fichier.name}
                    </span>
                    <span className="fiche__meta">{formaterTaille(fichier.size)}</span>
                  </span>
                  <button
                    type="button"
                    className="fiche__retirer"
                    onClick={() => setFichier(null)}
                    aria-label="Retirer le CV"
                    disabled={envoi}
                  >
                    <Close />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="cli-choix-cv"
                onClick={() => input.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  choisir(e.dataTransfer?.files)
                }}
              >
                <Trombone />
                <span>
                  Choisir mon CV <span className="cli-choix-cv__meta">PDF ou Word</span>
                </span>
              </button>
            )}
          </div>

          {erreur && (
            <p className="cli-alerte" role="alert">
              {erreur}
            </p>
          )}

          <div className="cli-modal__actions">
            <button
              type="button"
              className="bouton bouton--discret"
              onClick={onFerme}
              disabled={envoi}
            >
              Annuler
            </button>
            <button type="submit" className="bouton bouton--primaire" disabled={envoi}>
              {envoi ? (
                <>
                  <Spinner className="tourne" />
                  Envoi…
                </>
              ) : (
                'Enregistrer'
              )}
            </button>
          </div>

          <input
            ref={input}
            type="file"
            className="visuellement-cache"
            accept={ACCEPT_CV}
            onChange={(e) => {
              choisir(e.target.files)
              e.target.value = ''
            }}
          />
        </form>
      </div>
    </div>
  )
}
