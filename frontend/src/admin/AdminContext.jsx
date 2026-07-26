import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import * as api from './api.js'

const ContexteAdmin = createContext(null)

export function FournisseurAdmin({ children }) {
  const [admin, setAdmin] = useState(null)
  const [chargement, setChargement] = useState(true)

  // Au premier rendu, on demande au serveur si un cookie admin est valide.
  useEffect(() => {
    let actif = true
    api
      .recupererAdmin()
      .then((donnees) => actif && setAdmin(donnees))
      .catch(() => actif && setAdmin(null))
      .finally(() => actif && setChargement(false))
    return () => {
      actif = false
    }
  }, [])

  const connecter = useCallback(async (email, motDePasse) => {
    const connecte = await api.connecterAdmin(email, motDePasse)
    setAdmin(connecte)
    return connecte
  }, [])

  const deconnecter = useCallback(async () => {
    try {
      await api.deconnecterAdmin()
    } finally {
      setAdmin(null)
    }
  }, [])

  const valeur = useMemo(
    () => ({ admin, chargement, connecter, deconnecter }),
    [admin, chargement, connecter, deconnecter],
  )

  return <ContexteAdmin.Provider value={valeur}>{children}</ContexteAdmin.Provider>
}

export function useAdmin() {
  const contexte = useContext(ContexteAdmin)
  if (!contexte) throw new Error('useAdmin doit être utilisé dans un FournisseurAdmin')
  return contexte
}
