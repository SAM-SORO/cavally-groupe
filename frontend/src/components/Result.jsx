import { CheckSeal, Download, Restart } from './Icons.jsx'

function Champ({ libelle, valeur }) {
  if (!valeur) return null
  return (
    <div className="champ">
      <dt className="champ__cle">{libelle}</dt>
      <dd className="champ__valeur">{valeur}</dd>
    </div>
  )
}

export default function Result({ resultat, onRecommencer }) {
  const { url, nomFichier, meta } = resultat
  const articles = meta?.articles ?? 0
  const repartition = Object.entries(meta?.repartition ?? {})
  const maximum = Math.max(1, ...repartition.map(([, n]) => n))
  const secondes = meta?.dureeMs ? (meta.dureeMs / 1000).toFixed(1).replace('.', ',') : null

  // Un onglet par classe : au-delà d'une classe, on les détaille.
  const classes = meta?.classes ?? []
  const nommees = classes.filter((c) => c.nom)
  const multiClasses = classes.length > 1

  return (
    <section className="resultat" aria-live="polite">
      <div className="resultat__banniere">
        <CheckSeal className="resultat__sceau" />
        <div>
          <p className="resultat__compte">
            <span className="resultat__nombre">{articles}</span>
            <span className="resultat__unite">{articles > 1 ? 'articles détectés' : 'article détecté'}</span>
          </p>
          <p className="resultat__sous">
            {meta?.quantites ? `${meta.quantites} unités au total · ` : ''}
            {multiClasses ? `${classes.length} onglets, un par classe · ` : ''}
            Devis Excel prêt à être chiffré{secondes ? ` · analysé en ${secondes} s` : ''}
          </p>
        </div>
      </div>

      {(meta?.etablissement || nommees.length > 0 || meta?.anneeScolaire) && (
        <dl className="champs">
          <Champ libelle="Établissement" valeur={meta.etablissement} />
          {!multiClasses && <Champ libelle="Classe" valeur={nommees[0]?.nom} />}
          <Champ libelle="Année scolaire" valeur={meta.anneeScolaire} />
        </dl>
      )}

      {multiClasses && (
        <div className="classes">
          <p className="repartition__titre">Onglets générés</p>
          <ul className="classes__liste">
            {classes.map((classe, index) => (
              <li key={`${classe.nom}-${index}`} className="classes__jeton">
                <span className="classes__nom">{classe.nom || `Classe ${index + 1}`}</span>
                <span className="classes__compte">{classe.articles}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {repartition.length > 0 && (
        <div className="repartition">
          <p className="repartition__titre">Répartition par rubrique</p>
          <ul className="repartition__liste">
            {repartition.map(([categorie, nombre]) => (
              <li key={categorie} className="repartition__ligne">
                <span className="repartition__nom" title={categorie}>
                  {categorie}
                </span>
                <span className="repartition__barre" aria-hidden="true">
                  <span className="repartition__part" style={{ width: `${(nombre / maximum) * 100}%` }} />
                </span>
                <span className="repartition__nombre">{nombre}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="resultat__actions">
        <a className="bouton bouton--primaire bouton--large" href={url} download={nomFichier}>
          <Download />
          Télécharger le devis
        </a>
        <button type="button" className="bouton bouton--discret" onClick={onRecommencer}>
          <Restart />
          Traiter un autre document
        </button>
      </div>

      <p className="resultat__fichier" title={nomFichier}>
        {nomFichier}
      </p>
    </section>
  )
}
