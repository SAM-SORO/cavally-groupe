import { useId, useState } from 'react'

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
}) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const estMotDePasse = type === 'password'
  const typeEffectif = estMotDePasse && visible ? 'text' : type

  return (
    <div className="cli-champ">
      <label className="cli-champ__libelle" htmlFor={id}>
        {libelle}
        {facultatif && <span className="cli-champ__facultatif">facultatif</span>}
      </label>

      <div className="cli-champ__boite">
        <input
          id={id}
          className="cli-champ__saisie"
          type={typeEffectif}
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          inputMode={inputMode}
          placeholder={placeholder}
          required={required && !facultatif}
        />
        {estMotDePasse && (
          <button
            type="button"
            className="cli-champ__bascule"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            {visible ? 'Masquer' : 'Afficher'}
          </button>
        )}
      </div>

      {aide && <p className="cli-champ__aide">{aide}</p>}
    </div>
  )
}
