import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import * as api from './api.js'

const ContexteAuth = createContext(null)

export function FournisseurAuth({ children }) {
  const [client, setClient] = useState(null)
  const [chargement, setChargement] = useState(true)

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

  const deconnecter = useCallback(async () => {
    try {
      await api.deconnecter()
    } finally {
      setClient(null)
    }
  }, [])

  const valeur = useMemo(
    () => ({ client, chargement, inscrire, connecter, deconnecter }),
    [client, chargement, inscrire, connecter, deconnecter],
  )

  return <ContexteAuth.Provider value={valeur}>{children}</ContexteAuth.Provider>
}

export function useAuth() {
  const contexte = useContext(ContexteAuth)
  if (!contexte) throw new Error('useAuth doit être utilisé dans un FournisseurAuth')
  return contexte
}
