import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

// Outil interne — inchangé, monté sur /interne.
import App from './App.jsx'
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

          {/* Outil interne de l'équipe */}
          <Route path="/interne" element={<App />} />

          <Route path="*" element={<Navigate to="/depot" replace />} />
        </Routes>
      </FournisseurAuth>
    </BrowserRouter>
  </React.StrictMode>,
)
