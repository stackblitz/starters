/* Tiny shared editor glyphs. */
export function TrashIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 7h16" />
      <path d="M9.5 7V5.2c0-.7.5-1.2 1.2-1.2h2.6c.7 0 1.2.5 1.2 1.2V7" />
      <path d="M6.5 7l.8 12c.05.7.6 1.2 1.3 1.2h6.8c.7 0 1.25-.5 1.3-1.2l.8-12" />
      <path d="M10 11v5.5M14 11v5.5" />
    </svg>
  )
}
