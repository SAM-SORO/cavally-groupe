import { useRef, useState } from 'react'

import { CheckSeal, Close, DocumentStack, Spinner } from '../components/Icons.jsx'
import {
  ACCEPT_CLIENT,
  FORMATS_CLIENT,
  TAILLE_MAX_MO,
  deposerDemande,
  extensionDe,
  formatSupporte,
  formaterTaille,
} from './api.js'
import AppelConnexion from './AppelConnexion.jsx'
import { useAuth } from './AuthContext.jsx'
import Champ from './Champ.jsx'
import { CoquillePublique } from './Coquille.jsx'

const LIBELLES_FORMAT = {
  '.pdf': 'PDF',
  '.docx': 'DOCX',
  '.png': 'PNG',
  '.jpg': 'JPG',
  '.jpeg': 'JPG',
  '.webp': 'WEBP',
  '.heic': 'HEIC',
}

export default function PageDepot() {
  const { client, rafraichir } = useAuth()

  const [fichier, setFichier] = useState(null)
  const [texte, setTexte] = useState('')
  const [statut, setStatut] = useState('repos') // repos | envoi | confirme
  const [erreur, setErreur] = useState(null)
  const [survol, setSurvol] = useState(false)
  // Se déclenche au moment de l'envoi, pas à l'ouverture de la page.
  const [besoinConnexion, setBesoinConnexion] = useState(false)
  // Réclamé seulement si le compte n'a pas encore de numéro (ouverture Google).
  const [contact, setContact] = useState('')
  // Ce qui a effectivement été envoyé — sert au texte de confirmation.
  const [envoye, setEnvoye] = useState(null)

  const compteur = useRef(0)
  const input = useRef(null)

  const saisie = texte.trim()
  // Un document déposé l'emporte : la saisie devient inutile, et on le dit
  // plutôt que de l'ignorer en silence.
  const pretAEnvoyer = Boolean(fichier) || saisie.length > 0

  const choisir = (liste) => {
    const candidat = liste?.[0]
    if (!candidat) return
    if (!formatSupporte(candidat)) {
      setFichier(null)
      setErreur(`Format non pris en charge. Formats acceptés : ${FORMATS_CLIENT.join(', ')}.`)
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

  const auDepot = (evenement) => {
    evenement.preventDefault()
    compteur.current = 0
    setSurvol(false)
    choisir(evenement.dataTransfer?.files)
  }

  const envoyer = async () => {
    if (!pretAEnvoyer) return

    // La session n'est vérifiée qu'ici : on laisse préparer sa demande, et on
    // ne demande de s'identifier qu'au moment de l'envoi.
    if (!client) {
      setErreur(null)
      setBesoinConnexion(true)
      return
    }

    setErreur(null)
    setStatut('envoi')
    try {
      const reponse = await deposerDemande({
        fichier,
        // Le fichier prime : inutile d'envoyer les deux.
        texte: fichier ? '' : saisie,
        contact: contact.trim(),
      })
      // Le numéro vient peut-être d'être enregistré côté serveur : on relit la
      // session pour que la confirmation affiche la bonne valeur.
      if (!client.contact) await rafraichir()
      setEnvoye(reponse)
      setStatut('confirme')
    } catch (exception) {
      // Session expirée entre-temps : même invitation que pour un visiteur.
      if (exception.statut === 401) {
        setBesoinConnexion(true)
        setStatut('repos')
        return
      }
      setErreur(exception.message)
      setStatut('repos')
    }
  }

  const retirerFichier = () => {
    setFichier(null)
    setErreur(null)
  }

  const recommencer = () => {
    setFichier(null)
    setTexte('')
    setErreur(null)
    setBesoinConnexion(false)
    setEnvoye(null)
    setStatut('repos')
  }

  // — Confirmation —
  if (statut === 'confirme') {
    return (
      <CoquillePublique>
        <section className="cli-panneau cli-panneau--confirme" aria-live="polite">
          <CheckSeal className="cli-sceau" />
          <h1 className="cli-panneau__titre">Demande bien reçue</h1>
          <p className="cli-panneau__texte">
            Votre liste est transmise à notre équipe. Nous la traitons et revenons vers vous
            au {client?.contact || contact}.
          </p>
          <p className="cli-panneau__fichier">{envoye?.fichier}</p>
          <button type="button" className="bouton bouton--discret" onClick={recommencer}>
            Déposer une autre liste
          </button>
        </section>
      </CoquillePublique>
    )
  }

  const extension = fichier ? extensionDe(fichier.name) : ''
  const enCours = statut === 'envoi'

  return (
    <CoquillePublique large>
      <section className="cli-panneau cli-panneau--depot">
        <h1 className="cli-panneau__titre">Déposer une liste de fournitures</h1>
        <p className="cli-panneau__texte cli-panneau__texte--ligne">
          Téléversez votre document ou saisissez la liste de vos fournitures, mais pas les deux à
          la fois.
        </p>

        {/* Deux entrées côte à côte ; elles s'empilent sur petit écran. */}
        <div className="cli-duo">
          <div className="cli-duo__voie">
            <p className="cli-duo__titre">J’ai un document</p>

            {fichier ? (
              <div className="fiche cli-fiche">
                <div className="fiche__doc">
                  <span className="fiche__badge">{LIBELLES_FORMAT[extension] ?? 'DOC'}</span>
                  <span className="fiche__infos">
                    <span className="fiche__nom" title={fichier.name}>
                      {fichier.name}
                    </span>
                    <span className="fiche__meta">{formaterTaille(fichier.size)}</span>
                  </span>
                  <button
                    type="button"
                    className="fiche__retirer"
                    onClick={retirerFichier}
                    aria-label="Retirer le document"
                    disabled={enCours}
                  >
                    <Close />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={`depot cli-depot${survol ? ' est-survole' : ''}`}
                onClick={() => input.current?.click()}
                disabled={enCours}
                onDragEnter={(e) => {
                  e.preventDefault()
                  compteur.current += 1
                  setSurvol(true)
                }}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={(e) => {
                  e.preventDefault()
                  compteur.current = Math.max(0, compteur.current - 1)
                  if (compteur.current === 0) setSurvol(false)
                }}
                onDrop={auDepot}
              >
                <span className="depot__halo" aria-hidden="true" />
                <DocumentStack className="depot__illustration" />
                <span className="depot__titre">
                  {survol ? 'Relâchez pour ajouter' : 'Déposez votre liste'}
                </span>
                <span className="depot__sous-titre">
                  Glissez le fichier ici, ou{' '}
                  <span className="depot__lien">parcourez vos documents</span>
                </span>
                <span className="depot__formats">
                  {FORMATS_CLIENT.filter((f) => f !== '.jpeg').map((format) => (
                    <span key={format} className="jeton">
                      {format.replace('.', '')}
                    </span>
                  ))}
                </span>
              </button>
            )}
          </div>

          <p className="cli-duo__ou" aria-hidden="true">
            <span>ou</span>
          </p>

          <div className="cli-duo__voie">
            <label className="cli-duo__titre" htmlFor="saisie-liste">
              Je tape ma liste
            </label>
            <textarea
              id="saisie-liste"
              className="cli-saisie"
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              placeholder={'5 cahiers 200 pages\n2 stylos bleus\n1 boîte de crayons de couleur\n…'}
              // Le champ Téléphone n'apparaît qu'une fois, pour un compte
              // ouvert avec Google. Ce jour-là, la saisie cède deux lignes
              // pour que la page continue de tenir dans l'écran ; le reste du
              // temps elle garde toute sa hauteur.
              rows={client && !client.contact ? 7 : 9}
              disabled={Boolean(fichier) || enCours}
              spellCheck="false"
            />
            <p className="cli-duo__note">Une ligne par article</p>
          </div>
        </div>

        {/* Le compte existe mais n'a pas de numéro : c'est ici qu'il sert,
            c'est donc ici qu'on le demande — une seule fois. Sans ligne
            d'aide : le libellé suffit, et la page doit tenir dans l'écran. */}
        {client && !client.contact && (
          <Champ
            libelle="Téléphone"
            type="tel"
            valeur={contact}
            onChange={setContact}
            autoComplete="tel"
            inputMode="tel"
            placeholder="+225 07 97 99 19 99"
          />
        )}

        {erreur && (
          <p className="cli-alerte" role="alert">
            {erreur}
          </p>
        )}

        {besoinConnexion && (
          <AppelConnexion
            texte="Votre demande est prête. Identifiez-vous pour l’envoyer - cela prend quelques secondes."
            retour="/"
          />
        )}

        <button
          type="button"
          className="bouton bouton--primaire cli-bouton-bloc"
          onClick={envoyer}
          disabled={!pretAEnvoyer || enCours}
        >
          {enCours ? (
            <>
              <Spinner className="tourne" />
              Envoi en cours…
            </>
          ) : (
            'Envoyer ma demande'
          )}
        </button>

        <input
          ref={input}
          type="file"
          className="visuellement-cache"
          accept={ACCEPT_CLIENT}
          onChange={(e) => {
            choisir(e.target.files)
            e.target.value = ''
          }}
        />
      </section>
    </CoquillePublique>
  )
}
