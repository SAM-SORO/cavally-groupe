import { Navigate } from 'react-router-dom'

import { useAuth } from './AuthContext.jsx'

/** N'affiche la page que si une session valide existe côté serveur. */
export default function RouteProtegee({ children }) {
  const { client, chargement } = useAuth()

  if (chargement) {
    return (
      <div className="cli-attente" role="status" aria-label="Chargement">
        <span className="cli-attente__pulse" />
      </div>
    )
  }
  return client ? children : <Navigate to="/connexion" replace />
}
