import { useCallback, useEffect, useRef, useState } from 'react'

import { useAuth } from './AuthContext.jsx'

const SCRIPT_GIS = 'https://accounts.google.com/gsi/client'

// Le script n'est chargé qu'une fois pour toute l'application, même si deux
// pages montent le bouton l'une après l'autre.
let chargementEnCours = null

function chargerGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (chargementEnCours) return chargementEnCours

  chargementEnCours = new Promise((resoudre, rejeter) => {
    const balise = document.createElement('script')
    balise.src = SCRIPT_GIS
    balise.async = true
    balise.defer = true
    balise.onload = resoudre
    balise.onerror = () => {
      // Un échec ne doit pas figer la page : l'inscription classique reste là.
      chargementEnCours = null
      rejeter(new Error('Le service Google est injoignable. Utilisez le formulaire ci-dessus.'))
    }
    document.head.appendChild(balise)
  })
  return chargementEnCours
}

/**
 * Bouton « Continuer avec Google », affiché seulement si le serveur est
 * configuré pour vérifier les jetons (`GOOGLE_CLIENT_ID`). Sinon, rien : le
 * formulaire classique suffit et reste le chemin principal.
 *
 * Le navigateur ne fait que récupérer un jeton d'identité ; c'est le backend
 * qui en vérifie la signature auprès de Google avant d'ouvrir la session.
 */
export default function ConnexionGoogle({ onConnecte }) {
  const { google, connecterGoogle } = useAuth()
  const conteneur = useRef(null)
  const [erreur, setErreur] = useState(null)

  const auJeton = useCallback(
    async (credential) => {
      setErreur(null)
      try {
        await connecterGoogle(credential)
        onConnecte()
      } catch (exception) {
        setErreur(exception.message)
      }
    },
    [connecterGoogle, onConnecte],
  )

  useEffect(() => {
    if (!google.configure || !google.clientId) return undefined

    let actif = true
    chargerGoogle()
      .then(() => {
        if (!actif || !conteneur.current) return
        window.google.accounts.id.initialize({
          client_id: google.clientId,
          callback: (reponse) => auJeton(reponse.credential),
        })
        window.google.accounts.id.renderButton(conteneur.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text: 'continue_with',
          logo_alignment: 'center',
          locale: 'fr',
          width: 320,
        })
      })
      .catch((exception) => actif && setErreur(exception.message))

    return () => {
      actif = false
    }
  }, [google.configure, google.clientId, auJeton])

  if (!google.configure) return null

  return (
    <div className="cli-google">
      <p className="cli-ou">
        <span>ou</span>
      </p>
      <div className="cli-google__bouton" ref={conteneur} />
      {erreur && (
        <p className="cli-alerte" role="alert">
          {erreur}
        </p>
      )}
    </div>
  )
}
