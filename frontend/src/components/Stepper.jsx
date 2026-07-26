import { Check } from './Icons.jsx'

const ETAPES = [
  { cle: 'depot', titre: 'Dépôt' },
  { cle: 'analyse', titre: 'Analyse' },
  { cle: 'devis', titre: 'Devis' },
]

/** Fil d'exécution : 0 = dépôt, 1 = analyse, 2 = devis prêt. */
export default function Stepper({ actif }) {
  return (
    <ol className="fil" aria-label="Progression">
      {ETAPES.map((etape, index) => {
        const fait = index < actif
        const encours = index === actif
        return (
          <li
            key={etape.cle}
            className={`fil__etape${fait ? ' est-fait' : ''}${encours ? ' est-actif' : ''}`}
            aria-current={encours ? 'step' : undefined}
          >
            <span className="fil__pastille">
              {fait ? <Check className="fil__check" /> : index + 1}
            </span>
            <span className="fil__titre">{etape.titre}</span>
            {index < ETAPES.length - 1 && <span className="fil__trait" aria-hidden="true" />}
          </li>
        )
      })}
    </ol>
  )
}
