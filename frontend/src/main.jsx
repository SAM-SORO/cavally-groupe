import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

// Outil interne — logique inchangée, désormais derrière une session admin.
import App from './App.jsx'
import { FournisseurAdmin } from './admin/AdminContext.jsx'
import PageConnexionAdmin from './admin/PageConnexionAdmin.jsx'
import RouteAdmin from './admin/RouteAdmin.jsx'
import { FournisseurAuth } from './client/AuthContext.jsx'
import PageConnexion from './client/PageConnexion.jsx'
import PageDepot from './client/PageDepot.jsx'
import PageInscription from './client/PageInscription.jsx'
import RouteProtegee from './client/RouteProtegee.jsx'
import './styles/theme.css'
import './styles/app.css'
import './styles/client.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <FournisseurAuth>
        <FournisseurAdmin>
          <Routes>
            {/* Espace clients externes */}
            <Route path="/" element={<Navigate to="/depot" replace />} />
            <Route path="/inscription" element={<PageInscription />} />
            <Route path="/connexion" element={<PageConnexion />} />
            <Route
              path="/depot"
              element={
                <RouteProtegee>
                  <PageDepot />
                </RouteProtegee>
              }
            />

            {/* Outil interne de l'équipe — réservé aux admins */}
            <Route path="/interne/connexion" element={<PageConnexionAdmin />} />
            <Route
              path="/interne"
              element={
                <RouteAdmin>
                  <App />
                </RouteAdmin>
              }
            />

            <Route path="*" element={<Navigate to="/depot" replace />} />
          </Routes>
        </FournisseurAdmin>
      </FournisseurAuth>
    </BrowserRouter>
  </React.StrictMode>,
)
