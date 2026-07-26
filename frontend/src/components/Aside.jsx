const ETAPES = [
  {
    titre: 'Déposez le document',
    detail: 'Word, PDF, capture d’écran ou photo de la liste transmise par l’école.',
  },
  {
    titre: 'La liste est analysée',
    detail: 'Articles, quantités et rubriques sont relevés tels que le document les présente.',
  },
  {
    titre: 'Récupérez le devis',
    detail: 'Un classeur Excel structuré — un onglet par classe — formules déjà en place.',
  },
]

export default function Aside() {
  return (
    <aside className="rail">
      <p className="rail__intro">
        Déposez le document transmis par l’école — Word, PDF ou simple photo. Les articles et leurs
        quantités sont relevés, puis mis en forme dans un classeur Excel.
      </p>

      <section className="carte carte--marche">
        <h2 className="carte__titre">Le déroulé</h2>
        <ol className="marche">
          {ETAPES.map((etape, index) => (
            <li key={etape.titre} className="marche__item">
              <span className="marche__num">{String(index + 1).padStart(2, '0')}</span>
              <span className="marche__texte">
                <span className="marche__titre">{etape.titre}</span>
                <span className="marche__detail">{etape.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  )
}
