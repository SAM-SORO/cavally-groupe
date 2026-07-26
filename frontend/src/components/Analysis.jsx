import { useEffect, useState } from 'react'

import { Check, Spinner } from './Icons.jsx'

const PHASES = [
  { titre: 'Lecture du document', detail: 'Normalisation et envoi sécurisé', ms: 900 },
  { titre: 'Extraction des articles', detail: 'Repérage des libellés et des quantités', ms: 4200 },
  { titre: 'Génération du fichier Excel', detail: 'Mise en forme, formules et total', ms: null },
]

export default function Analysis({ nomFichier, onAnnuler }) {
  const [phase, setPhase] = useState(0)
  const [progression, setProgression] = useState(6)

  // Avancée des phases : la dernière reste en cours jusqu'à la réponse du serveur.
  useEffect(() => {
    const minuteries = []
    let cumul = 0
    PHASES.forEach((etape, index) => {
      if (etape.ms === null) return
      cumul += etape.ms
      minuteries.push(setTimeout(() => setPhase(index + 1), cumul))
    })
    return () => minuteries.forEach(clearTimeout)
  }, [])

  // Barre asymptotique : elle ne prétend jamais avoir fini avant le serveur.
  useEffect(() => {
    const tic = setInterval(() => {
      setProgression((valeur) => valeur + (93 - valeur) * 0.07)
    }, 220)
    return () => clearInterval(tic)
  }, [])

  return (
    <section className="analyse" aria-live="polite" aria-busy="true">
      <div className="analyse__tete">
        <div>
          <p className="analyse__titre">Analyse en cours</p>
          <p className="analyse__fichier" title={nomFichier}>
            {nomFichier}
          </p>
        </div>
        <span className="analyse__compteur">{Math.round(progression)} %</span>
      </div>

      <div className="jauge" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progression)}>
        <span className="jauge__remplissage" style={{ width: `${progression}%` }}>
          <span className="jauge__lueur" aria-hidden="true" />
        </span>
      </div>

      <ol className="phases">
        {PHASES.map((etape, index) => {
          const fait = index < phase
          const encours = index === phase
          return (
            <li key={etape.titre} className={`phases__item${fait ? ' est-fait' : ''}${encours ? ' est-actif' : ''}`}>
              <span className="phases__marque">
                {fait ? <Check /> : encours ? <Spinner className="tourne" /> : <span className="phases__puce" />}
              </span>
              <span className="phases__texte">
                <span className="phases__titre">{etape.titre}</span>
                <span className="phases__detail">{etape.detail}</span>
              </span>
            </li>
          )
        })}
      </ol>

      <button type="button" className="bouton bouton--discret analyse__annuler" onClick={onAnnuler}>
        Annuler l'analyse
      </button>
    </section>
  )
}
