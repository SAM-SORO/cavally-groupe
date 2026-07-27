import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

// Outil interne — logique inchangée, désormais derrière une session admin.
import App from './App.jsx'
import { FournisseurAdmin } from './admin/AdminContext.jsx'
import PageConnexionAdmin from './admin/PageConnexionAdmin.jsx'
import PageRepetiteursAdmin from './admin/PageRepetiteursAdmin.jsx'
import RouteAdmin from './admin/RouteAdmin.jsx'
import { FournisseurAuth } from './client/AuthContext.jsx'
import PageConnexion from './client/PageConnexion.jsx'
import PageDepot from './client/PageDepot.jsx'
import PageInscription from './client/PageInscription.jsx'
import PageRepetiteurs from './client/PageRepetiteurs.jsx'
import PageTemoignages from './client/PageTemoignages.jsx'
import './styles/theme.css'
import './styles/app.css'
import './styles/client.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <FournisseurAuth>
        <FournisseurAdmin>
          <Routes>
            {/* Espace clients externes — les trois menus de la navbar.
                Les pages sont publiques ; seules les actions (déposer une
                liste, enregistrer un CV) demandent une session. */}
            <Route path="/" element={<PageDepot />} />
            <Route path="/temoignages" element={<PageTemoignages />} />
            <Route path="/repetiteurs" element={<PageRepetiteurs />} />

            <Route path="/inscription" element={<PageInscription />} />
            <Route path="/connexion" element={<PageConnexion />} />

            {/* Ancienne adresse du dépôt, devenue le contenu de l'accueil. */}
            <Route path="/depot" element={<Navigate to="/" replace />} />

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
            <Route
              path="/interne/repetiteurs"
              element={
                <RouteAdmin>
                  <PageRepetiteursAdmin />
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
