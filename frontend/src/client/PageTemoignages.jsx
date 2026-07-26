import { Lecture } from '../components/Icons.jsx'
import { CoquillePublique } from './Coquille.jsx'
import { TEMOIGNAGES, estIntegration } from './temoignages.js'

/** Le média d'une carte : iframe, fichier vidéo, ou emplacement en attente. */
function Media({ temoignage }) {
  const { video, poster, personne } = temoignage

  if (!video) {
    return (
      <div className="tem-carte__media tem-carte__media--vide">
        <Lecture />
        <span>Vidéo à venir</span>
      </div>
    )
  }

  if (estIntegration(video)) {
    return (
      <div className="tem-carte__media">
        <iframe
          src={video}
          title={`Témoignage — ${personne}`}
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <div className="tem-carte__media">
      {/* `preload="metadata"` : on ne télécharge pas toutes les vidéos de la
          grille à l'ouverture de la page, seulement de quoi afficher la durée. */}
      <video src={video} poster={poster || undefined} controls preload="metadata" />
    </div>
  )
}

export default function PageTemoignages() {
  return (
    <CoquillePublique large>
      <header className="cli-section">
        <h1 className="cli-section__titre">Témoignage</h1>
        <p className="cli-section__chapo">
          Ce que disent les parents et les établissements qui nous confient leurs listes.
        </p>
      </header>

      {TEMOIGNAGES.length === 0 ? (
        <p className="cli-vide">Les premiers témoignages arrivent bientôt.</p>
      ) : (
        <ul className="tem-grille">
          {TEMOIGNAGES.map((temoignage) => (
            <li key={temoignage.id} className="tem-carte">
              <Media temoignage={temoignage} />
              <div className="tem-carte__pied">
                <p className="tem-carte__personne">{temoignage.personne}</p>
                {temoignage.role && <p className="tem-carte__role">{temoignage.role}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </CoquillePublique>
  )
}
