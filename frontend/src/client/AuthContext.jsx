import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import * as api from './api.js'

const ContexteAuth = createContext(null)

export function FournisseurAuth({ children }) {
  const [client, setClient] = useState(null)
  const [chargement, setChargement] = useState(true)
  // Le bouton Google n'apparaît que si le serveur sait traiter le jeton.
  // Le client_id vient de `backend/.env` : une seule source de vérité.
  const [google, setGoogle] = useState({ configure: false, clientId: '' })

  // Au premier rendu, on demande au serveur si un cookie de session est valide.
  useEffect(() => {
    let actif = true
    api
      .recupererSession()
      .then((donnees) => actif && setClient(donnees))
      .catch(() => actif && setClient(null))
      .finally(() => actif && setChargement(false))
    return () => {
      actif = false
    }
  }, [])

  useEffect(() => {
    let actif = true
    api
      .etatService()
      .then((etat) => {
        if (!actif) return
        setGoogle({
          configure: Boolean(etat?.google_configure),
          clientId: etat?.google_client_id || '',
        })
      })
      // Service injoignable : on se contente de ne pas proposer Google.
      .catch(() => {})
    return () => {
      actif = false
    }
  }, [])

  const inscrire = useCallback(async (donnees) => {
    const cree = await api.inscrire(donnees)
    setClient(cree)
    return cree
  }, [])

  const connecter = useCallback(async (email, motDePasse) => {
    const connecte = await api.connecter(email, motDePasse)
    setClient(connecte)
    return connecte
  }, [])

  const connecterGoogle = useCallback(async (credential) => {
    const connecte = await api.connecterAvecGoogle(credential)
    setClient(connecte)
    return connecte
  }, [])

  const deconnecter = useCallback(async () => {
    try {
      await api.deconnecter()
    } finally {
      setClient(null)
    }
  }, [])

  /** Relit la session — après que le serveur ait complété le compte. */
  const rafraichir = useCallback(async () => {
    try {
      setClient(await api.recupererSession())
    } catch {
      /* session perdue : l'appel suivant s'en chargera */
    }
  }, [])

  const valeur = useMemo(
    () => ({ client, chargement, google, inscrire, connecter, connecterGoogle, deconnecter, rafraichir }),
    [client, chargement, google, inscrire, connecter, connecterGoogle, deconnecter, rafraichir],
  )

  return <ContexteAuth.Provider value={valeur}>{children}</ContexteAuth.Provider>
}

export function useAuth() {
  const contexte = useContext(ContexteAuth)
  if (!contexte) throw new Error('useAuth doit être utilisé dans un FournisseurAuth')
  return contexte
}
