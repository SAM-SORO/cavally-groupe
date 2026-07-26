import { useRef, useState } from 'react'

import { CheckSeal, Close, DocumentStack, Spinner } from '../components/Icons.jsx'
import {
  ACCEPT_CLIENT,
  FORMATS_CLIENT,
  TAILLE_MAX_MO,
  deposerDocument,
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
  const [statut, setStatut] = useState('repos') // repos | envoi | confirme
  const [erreur, setErreur] = useState(null)
  const [survol, setSurvol] = useState(false)
  // Se déclenche au moment de l'envoi, pas à l'ouverture de la page.
  const [besoinConnexion, setBesoinConnexion] = useState(false)
  // Réclamé seulement si le compte n'a pas encore de numéro (ouverture Google).
  const [contact, setContact] = useState('')

  const compteur = useRef(0)
  const input = useRef(null)

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
    if (!fichier) return

    // La session n'est vérifiée qu'ici : on laisse choisir son document, et
    // on ne demande de s'identifier qu'au moment de l'envoi.
    if (!client) {
      setErreur(null)
      setBesoinConnexion(true)
      return
    }

    setErreur(null)
    setStatut('envoi')
    try {
      await deposerDocument(fichier, contact.trim())
      // Le numéro vient peut-être d'être enregistré côté serveur : on relit la
      // session pour que la confirmation affiche la bonne valeur.
      if (!client.contact) await rafraichir()
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

  const recommencer = () => {
    setFichier(null)
    setErreur(null)
    setBesoinConnexion(false)
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
          <p className="cli-panneau__fichier">{fichier?.name}</p>
          <button type="button" className="bouton bouton--discret" onClick={recommencer}>
            Déposer une autre liste
          </button>
        </section>
      </CoquillePublique>
    )
  }

  const extension = fichier ? extensionDe(fichier.name) : ''

  return (
    <CoquillePublique>
      <section className="cli-panneau">
        <h1 className="cli-panneau__titre">Déposer une liste de fournitures</h1>
        <p className="cli-panneau__texte">
          Word, PDF ou photo de la liste. Notre équipe s’occupe du reste.
        </p>

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
                onClick={recommencer}
                aria-label="Retirer le document"
                disabled={statut === 'envoi'}
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
              Glissez le fichier ici, ou <span className="depot__lien">parcourez vos documents</span>
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

        {/* Le compte existe mais n'a pas de numéro : c'est ici qu'il sert,
            c'est donc ici qu'on le demande — une seule fois. */}
        {client && !client.contact && (
          <Champ
            libelle="Téléphone"
            type="tel"
            valeur={contact}
            onChange={setContact}
            autoComplete="tel"
            inputMode="tel"
            placeholder="+225 07 97 99 19 99"
            aide="C’est par là que notre équipe vous recontacte."
          />
        )}

        {erreur && (
          <p className="cli-alerte" role="alert">
            {erreur}
          </p>
        )}

        {besoinConnexion && (
          <AppelConnexion
            texte="Votre document est prêt. Identifiez-vous pour l’envoyer — cela prend quelques secondes."
            retour="/"
          />
        )}

        <button
          type="button"
          className="bouton bouton--primaire cli-bouton-bloc"
          onClick={envoyer}
          disabled={!fichier || statut === 'envoi'}
        >
          {statut === 'envoi' ? (
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
