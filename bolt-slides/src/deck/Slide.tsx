import type { CSSProperties, ReactNode } from 'react'

/* One full-viewport slide. Content REFLOWS responsively (no fixed canvas).
   - center: centered + text-align center (cover, statement, quote, CTA)
   - full:   no padding, edge-to-edge (for split / full-bleed media)
   - nav:    label shown in the thumbnail rail
   - notes:  speaker notes shown in the presenter overlay
   Non-full slides wrap content in a max-width .container. */
export default function Slide({
  children, center, full, className = '', style,
}: {
  children: ReactNode
  center?: boolean
  full?: boolean
  nav?: string
  notes?: string
  className?: string
  style?: CSSProperties
}) {
  return (
    <div className={`slide${center ? ' center' : ''}${full ? ' full' : ''}${className ? ' ' + className : ''}`} style={style}>
      {full ? children : <div className="container">{children}</div>}
    </div>
  )
}
