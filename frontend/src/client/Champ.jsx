import { useId, useState } from 'react'

import { Eye, EyeOff } from '../components/Icons.jsx'

/**
 * Champ de formulaire de l'espace clients.
 *
 * `large` : dans un formulaire en deux colonnes, le champ occupe toute la
 * largeur (sans effet en une seule colonne).
 */
export default function Champ({
  libelle,
  type = 'text',
  valeur,
  onChange,
  facultatif = false,
  aide,
  autoComplete,
  inputMode,
  placeholder,
  required = true,
  large = false,
}) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const estMotDePasse = type === 'password'
  const typeEffectif = estMotDePasse && visible ? 'text' : type

  return (
    <div className={large ? 'cli-champ cli-champ--large' : 'cli-champ'}>
      <label className="cli-champ__libelle" htmlFor={id}>
        {libelle}
        {facultatif && <span className="cli-champ__facultatif">facultatif</span>}
      </label>

      <div className="cli-champ__boite">
        <input
          id={id}
          className={estMotDePasse ? 'cli-champ__saisie cli-champ__saisie--protegee' : 'cli-champ__saisie'}
          type={typeEffectif}
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          inputMode={inputMode}
          placeholder={placeholder}
          required={required && !facultatif}
        />
        {estMotDePasse && (
          // Standard de l'œil : l'état est porté par l'icône, et redit en clair
          // aux lecteurs d'écran par `aria-label` + `aria-pressed`.
          <button
            type="button"
            className="cli-champ__oeil"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            aria-pressed={visible}
            title={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            {visible ? <EyeOff /> : <Eye />}
          </button>
        )}
      </div>

      {aide && <p className="cli-champ__aide">{aide}</p>}
    </div>
  )
}
