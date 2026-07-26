import { useCallback, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import { Spinner } from '../components/Icons.jsx'
import { useAuth } from './AuthContext.jsx'
import Champ from './Champ.jsx'
import ConnexionGoogle from './ConnexionGoogle.jsx'
import { CoquilleAuth } from './Coquille.jsx'
import { avecRetour, destinationRetour } from './navigation.js'

const LONGUEUR_MIN_MOT_DE_PASSE = 8

export default function PageInscription() {
  const { client, inscrire } = useAuth()
  const naviguer = useNavigate()
  const [parametres] = useSearchParams()

  const [champs, setChamps] = useState({
    nom_complet: '',
    contact: '',
    email: '',
    etablissement: '',
    mot_de_passe: '',
  })
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)

  const retour = destinationRetour(parametres)
  const apresConnexion = useCallback(() => naviguer(retour, { replace: true }), [naviguer, retour])

  if (client) return <Navigate to={retour} replace />

  const majChamp = (cle) => (valeur) => setChamps((etat) => ({ ...etat, [cle]: valeur }))

  const soumettre = async (evenement) => {
    evenement.preventDefault()
    setErreur(null)

    if (champs.mot_de_passe.length < LONGUEUR_MIN_MOT_DE_PASSE) {
      setErreur(`Le mot de passe doit contenir au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`)
      return
    }

    setEnvoi(true)
    try {
      await inscrire({
        nom_complet: champs.nom_complet.trim(),
        contact: champs.contact.trim(),
        email: champs.email.trim(),
        // Champ facultatif : on n'envoie rien plutôt qu'une chaîne vide.
        etablissement: champs.etablissement.trim() || null,
        mot_de_passe: champs.mot_de_passe,
      })
      naviguer(retour, { replace: true })
    } catch (exception) {
      setErreur(exception.message)
      setEnvoi(false)
    }
  }

  return (
    <CoquilleAuth large>
      <section className="cli-carte">
        <h1 className="cli-carte__titre">Créer un compte</h1>
        <p className="cli-carte__chapo">Quelques informations, et vous pouvez déposer vos listes.</p>

        {/* Deux colonnes sur écran large, une seule sur mobile — voir client.css. */}
        <form className="cli-formulaire cli-formulaire--duo" onSubmit={soumettre} noValidate>
          <Champ
            libelle="Nom complet"
            valeur={champs.nom_complet}
            onChange={majChamp('nom_complet')}
            autoComplete="name"
            placeholder="Koffi Aya"
          />
          <Champ
            libelle="Téléphone"
            type="tel"
            valeur={champs.contact}
            onChange={majChamp('contact')}
            autoComplete="tel"
            inputMode="tel"
            placeholder="+225 07 97 99 19 99"
          />
          {/* Champ long : il occupe la ligne entière, les autres vont par deux. */}
          <Champ
            libelle="Adresse email"
            type="email"
            valeur={champs.email}
            onChange={majChamp('email')}
            autoComplete="email"
            placeholder="vous@exemple.com"
            large
          />
          <Champ
            libelle="Établissement"
            valeur={champs.etablissement}
            onChange={majChamp('etablissement')}
            autoComplete="organization"
            placeholder="Groupe scolaire…"
            facultatif
            aide="À laisser vide si vous êtes un particulier."
          />
          <Champ
            libelle="Mot de passe"
            type="password"
            valeur={champs.mot_de_passe}
            onChange={majChamp('mot_de_passe')}
            autoComplete="new-password"
            aide={`${LONGUEUR_MIN_MOT_DE_PASSE} caractères minimum.`}
          />

          {erreur && (
            <p className="cli-alerte" role="alert">
              {erreur}
            </p>
          )}

          <button type="submit" className="bouton bouton--primaire cli-bouton-bloc" disabled={envoi}>
            {envoi ? (
              <>
                <Spinner className="tourne" />
                Création…
              </>
            ) : (
              'Créer mon compte'
            )}
          </button>
        </form>

        <ConnexionGoogle onConnecte={apresConnexion} />
      </section>

      <p className="cli-bascule">
        Déjà inscrit ? <Link to={avecRetour('/connexion', retour)}>Se connecter</Link>
      </p>
    </CoquilleAuth>
  )
}
