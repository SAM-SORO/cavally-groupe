import { Alert, Restart } from './Icons.jsx'

export default function Failure({ message, nomFichier, onReessayer, onRecommencer }) {
  return (
    <section className="echec" role="alert">
      <div className="echec__tete">
        <Alert className="echec__icone" />
        <div>
          <p className="echec__titre">L’analyse n’a pas abouti</p>
          <p className="echec__message">{message}</p>
        </div>
      </div>

      {nomFichier && <p className="echec__fichier">{nomFichier}</p>}

      <div className="echec__actions">
        {onReessayer && (
          <button type="button" className="bouton bouton--primaire" onClick={onReessayer}>
            <Restart />
            Relancer l’analyse
          </button>
        )}
        <button type="button" className="bouton bouton--discret" onClick={onRecommencer}>
          Choisir un autre document
        </button>
      </div>
    </section>
  )
}
