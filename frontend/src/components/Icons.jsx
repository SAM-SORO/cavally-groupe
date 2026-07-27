/**
 * Pictogrammes maison — tracés au trait, hérités de `currentColor`.
 * Volontairement sobres et « papeterie » : rien de décoratif, pas d'imagerie IA.
 */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function DocumentStack({ className }) {
  return (
    <svg className={className} viewBox="0 0 72 72" width="72" height="72" aria-hidden="true">
      {/* feuille arrière, inclinée */}
      <g transform="rotate(-9 36 40)">
        <rect x="17" y="14" width="30" height="40" rx="4" fill="var(--white)" stroke="var(--line)" strokeWidth="1.6" />
      </g>
      {/* feuille avant, accent charte */}
      <g transform="rotate(6 36 40)">
        <rect x="25" y="12" width="30" height="40" rx="4" fill="var(--brand-veil)" stroke="var(--brand)" strokeWidth="1.6" />
        <path d="M31 24h18M31 31h18M31 38h11" stroke="var(--brand-press)" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      {/* flèche de dépôt */}
      <g transform="translate(40 40)">
        <circle cx="11" cy="11" r="11" fill="var(--black)" />
        <path d="M11 16.5V6M6.8 10.2 11 6l4.2 4.2" fill="none" stroke="var(--white)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

export function Check({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <path d="m4.5 10.5 3.6 3.6L15.5 6.5" {...stroke} strokeWidth={2} />
    </svg>
  )
}

export function CheckSeal({ className }) {
  return (
    <svg className={className} viewBox="0 0 56 56" width="56" height="56" aria-hidden="true">
      <circle className="seal-ring" cx="28" cy="28" r="25" fill="var(--brand-veil)" stroke="var(--brand)" strokeWidth="2" />
      <path className="seal-check" d="m17.5 28.8 7.2 7.2L39 21.7" fill="none" stroke="var(--black)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Alert({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path d="M12 4.2 21 20H3l9-15.8Z" fill="var(--brand)" stroke="var(--brand-press)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M12 10.2v4.1" stroke="var(--black)" strokeWidth={1.8} strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.05" fill="var(--black)" />
    </svg>
  )
}

export function Download({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <path d="M10 3v9.2M6.3 8.7 10 12.4l3.7-3.7M3.6 15.4h12.8" {...stroke} strokeWidth={1.8} />
    </svg>
  )
}

export function Restart({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <path d="M16.2 10a6.2 6.2 0 1 1-1.9-4.5" {...stroke} />
      <path d="M16.4 3.2v3.4H13" {...stroke} />
    </svg>
  )
}

export function Close({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <path d="m6 6 8 8M14 6l-8 8" {...stroke} strokeWidth={1.8} />
    </svg>
  )
}

export function Menu({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <path d="M3.2 5.5h13.6M3.2 10h13.6M3.2 14.5h13.6" {...stroke} strokeWidth={1.8} />
    </svg>
  )
}

export function Lecture({ className }) {
  return (
    <svg className={className} viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
      <circle cx="24" cy="24" r="19" fill="var(--brand-veil)" stroke="var(--brand)" strokeWidth="1.6" />
      <path d="M20 17.5 31 24l-11 6.5V17.5Z" fill="var(--black)" />
    </svg>
  )
}

export function Trombone({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <path d="M13.6 9.2 9.4 13.4a2.9 2.9 0 0 1-4.1-4.1l5.2-5.2a1.9 1.9 0 1 1 2.7 2.7l-5.2 5.2a0.9 0.9 0 0 1-1.3-1.3l4.6-4.6" {...stroke} />
    </svg>
  )
}

export function Eye({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M2.1 12.3a1 1 0 0 1 0-.7 10.7 10.7 0 0 1 19.8 0 1 1 0 0 1 0 .7 10.7 10.7 0 0 1-19.8 0Z" {...stroke} />
      <circle cx="12" cy="12" r="3" {...stroke} />
    </svg>
  )
}

export function EyeOff({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M10.7 5.1a10.7 10.7 0 0 1 11.2 6.5 1 1 0 0 1 0 .7 10.7 10.7 0 0 1-1.4 2.5" {...stroke} />
      <path d="M14.1 14.2a3 3 0 0 1-4.3-4.3" {...stroke} />
      <path d="M17.5 17.5A10.7 10.7 0 0 1 2.1 12.3a1 1 0 0 1 0-.7 10.7 10.7 0 0 1 4.4-5.1" {...stroke} />
      <path d="m3 3 18 18" {...stroke} />
    </svg>
  )
}

export function Spinner({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <circle cx="10" cy="10" r="7.4" fill="none" stroke="var(--line)" strokeWidth="2" />
      <path d="M10 2.6a7.4 7.4 0 0 1 7.4 7.4" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function Sheet({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <rect x="2.8" y="3.4" width="14.4" height="13.2" rx="2" {...stroke} />
      <path d="M2.8 7.6h14.4M8 7.6v9M2.8 12.1h14.4" {...stroke} />
    </svg>
  )
}
