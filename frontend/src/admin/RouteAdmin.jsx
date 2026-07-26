import { Navigate } from 'react-router-dom'

import { useAdmin } from './AdminContext.jsx'

/**
 * N'affiche l'outil interne que si une session admin valide existe côté serveur.
 *
 * Ce garde-fou est un confort d'interface : le contrôle qui fait autorité est
 * la dépendance `admin_courant` sur `POST /api/process`. Même en forçant
 * l'affichage, aucun devis ne peut être généré sans session admin.
 */
export default function RouteAdmin({ children }) {
  const { admin, chargement } = useAdmin()

  if (chargement) {
    return (
      <div className="cli-attente" role="status" aria-label="Vérification de la session">
        <span className="cli-attente__pulse" />
      </div>
    )
  }
  return admin ? children : <Navigate to="/interne/connexion" replace />
}
