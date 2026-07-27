import { useCallback, useRef, useState } from 'react'

import { ACCEPT_ATTR, FORMATS_ACCEPTES, extensionDe, formaterTaille } from '../api.js'
import { useCollageFichier } from './collage.js'
import { Close, DocumentStack, Sheet } from './Icons.jsx'

const LIBELLES_FORMAT = {
  '.pdf': 'PDF',
  '.docx': 'DOCX',
  '.png': 'PNG',
  '.jpg': 'JPG',
  '.jpeg': 'JPG',
  '.webp': 'WEBP',
  '.heic': 'HEIC',
  '.txt': 'TXT',
}

export default function Dropzone({ fichier, onFichier, onEffacer, onLancer, erreur }) {
  const [survol, setSurvol] = useState(false)
  const compteur = useRef(0)
  const input = useRef(null)

  const ouvrirSelecteur = () => input.current?.click()

  const traiter = (liste) => {
    const choisi = liste?.[0]
    if (choisi) onFichier(choisi)
  }

  // Ctrl+V : une capture d'écran vaut un dépôt.
  useCollageFichier(useCallback((colle) => onFichier(colle), [onFichier]))

  const auDepot = (evenement) => {
    evenement.preventDefault()
    compteur.current = 0
    setSurvol(false)
    traiter(evenement.dataTransfer?.files)
  }

  const auSurvolEntree = (evenement) => {
    evenement.preventDefault()
    compteur.current += 1
    setSurvol(true)
  }

  const auSurvolSortie = (evenement) => {
    evenement.preventDefault()
    compteur.current = Math.max(0, compteur.current - 1)
    if (compteur.current === 0) setSurvol(false)
  }

  // — Fichier retenu : on remplace la zone par la fiche du document —
  if (fichier) {
    const extension = extensionDe(fichier.name)
    return (
      <div className="fiche" role="group" aria-label="Document sélectionné">
        <div className="fiche__doc">
          <span className="fiche__badge" data-format={LIBELLES_FORMAT[extension] ?? 'DOC'}>
            {LIBELLES_FORMAT[extension] ?? 'DOC'}
          </span>
          <span className="fiche__infos">
            <span className="fiche__nom" title={fichier.name}>
              {fichier.name}
            </span>
            <span className="fiche__meta">
              {formaterTaille(fichier.size)} · prêt pour l'analyse
            </span>
          </span>
          <button type="button" className="fiche__retirer" onClick={onEffacer} aria-label="Retirer le document">
            <Close />
          </button>
        </div>

        {erreur && (
          <p className="fiche__alerte" role="alert">
            {erreur}
          </p>
        )}

        <div className="fiche__actions">
          <button type="button" className="bouton bouton--primaire" onClick={onLancer} disabled={Boolean(erreur)}>
            <Sheet />
            Générer le devis Excel
          </button>
          <button type="button" className="bouton bouton--discret" onClick={ouvrirSelecteur}>
            Choisir un autre document
          </button>
        </div>

        <input
          ref={input}
          type="file"
          className="visuellement-cache"
          accept={ACCEPT_ATTR}
          onChange={(e) => {
            traiter(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
    )
  }

  // — Zone de dépôt au repos —
  return (
    <div className="depot-bloc">
      <button
        type="button"
        className={`depot${survol ? ' est-survole' : ''}`}
        onClick={ouvrirSelecteur}
        onDragEnter={auSurvolEntree}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={auSurvolSortie}
        onDrop={auDepot}
        aria-label="Déposer ou choisir une liste de fournitures"
      >
        <span className="depot__halo" aria-hidden="true" />
        <DocumentStack className="depot__illustration" />
        <span className="depot__titre">
          {survol ? 'Relâchez pour analyser' : 'Déposez la liste de fournitures'}
        </span>
        <span className="depot__sous-titre">
          Glissez le fichier ici, <span className="depot__lien">parcourez vos documents</span> ou
          collez une capture <kbd className="touche">Ctrl</kbd>
          <kbd className="touche">V</kbd>
        </span>
        <span className="depot__formats">
          {FORMATS_ACCEPTES.filter((f) => f !== '.jpeg').map((format) => (
            <span key={format} className="jeton">
              {format.replace('.', '')}
            </span>
          ))}
        </span>
      </button>

      {erreur && (
        <p className="depot__alerte" role="alert">
          {erreur}
        </p>
      )}

      <input
        ref={input}
        type="file"
        className="visuellement-cache"
        accept={ACCEPT_ATTR}
        onChange={(e) => {
          traiter(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
