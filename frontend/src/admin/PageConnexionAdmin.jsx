import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import logo from '../assets/logo-cavally-livres.png'
import Champ from '../client/Champ.jsx'
import { Spinner } from '../components/Icons.jsx'
import { useAdmin } from './AdminContext.jsx'

export default function PageConnexionAdmin() {
  const { admin, connecter } = useAdmin()
  const naviguer = useNavigate()

  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)

  if (admin) return <Navigate to="/interne" replace />

  const soumettre = async (evenement) => {
    evenement.preventDefault()
    setErreur(null)
    setEnvoi(true)
    try {
      await connecter(email.trim(), motDePasse)
      naviguer('/interne', { replace: true })
    } catch (exception) {
      setErreur(exception.message)
      setEnvoi(false)
    }
  }

  return (
    <div className="cli-page cli-page--auth">
      <main className="cli-auth">
        <span className="cli-auth__marque">
          <img src={logo} alt="Cavally Livres" width="758" height="240" />
        </span>

        <section className="cli-carte">
          <p className="adm-etiquette">Espace équipe</p>
          <h1 className="cli-carte__titre">Connexion administrateur</h1>
          <p className="cli-carte__chapo">
            L’outil de génération des devis est réservé à l’équipe Cavally.
          </p>

          <form className="cli-formulaire" onSubmit={soumettre} noValidate>
            <Champ
              libelle="Identifiant"
              type="email"
              valeur={email}
              onChange={setEmail}
              autoComplete="username"
              placeholder="vous@cavally.ci"
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
                'Accéder à l’outil'
              )}
            </button>
          </form>
        </section>
      </main>
    </div>
  )
}
