import { useCallback, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import { Spinner } from '../components/Icons.jsx'
import { useAuth } from './AuthContext.jsx'
import Champ from './Champ.jsx'
import ConnexionGoogle from './ConnexionGoogle.jsx'
import { CoquilleAuth } from './Coquille.jsx'
import { avecRetour, destinationRetour } from './navigation.js'

export default function PageConnexion() {
  const { client, connecter } = useAuth()
  const naviguer = useNavigate()
  const [parametres] = useSearchParams()

  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)

  // Là où l'utilisateur voulait aller avant d'être invité à s'identifier.
  const retour = destinationRetour(parametres)

  // Référence stable : `ConnexionGoogle` la met en dépendance d'un effet.
  const apresConnexion = useCallback(() => naviguer(retour, { replace: true }), [naviguer, retour])

  if (client) return <Navigate to={retour} replace />

  const soumettre = async (evenement) => {
    evenement.preventDefault()
    setErreur(null)
    setEnvoi(true)
    try {
      await connecter(email.trim(), motDePasse)
      naviguer(retour, { replace: true })
    } catch (exception) {
      setErreur(exception.message)
      setEnvoi(false)
    }
  }

  return (
    <CoquilleAuth>
      <section className="cli-carte">
        <h1 className="cli-carte__titre">Connexion</h1>
        <p className="cli-carte__chapo">Accédez à votre espace pour déposer une liste.</p>

        <form className="cli-formulaire" onSubmit={soumettre} noValidate>
          <Champ
            libelle="Adresse email"
            type="email"
            valeur={email}
            onChange={setEmail}
            autoComplete="email"
            placeholder="vous@exemple.com"
          />
          <Champ
            libelle="Mot de passe"
            type="password"
            valeur={motDePasse}
            onChange={setMotDePasse}
            autoComplete="current-password"
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
                Connexion…
              </>
            ) : (
              'Se connecter'
            )}
          </button>
        </form>

        <ConnexionGoogle onConnecte={apresConnexion} />
      </section>

      <p className="cli-bascule">
        Pas encore de compte ? <Link to={avecRetour('/inscription', retour)}>Créer un compte</Link>
      </p>
    </CoquilleAuth>
  )
}
