import type { ReactNode } from 'react'
import Reveal from '../deck/Reveal'

/* A full-bleed feature slide: text one side, edge-to-edge media the other.
   `flip` swaps sides. Stacks vertically on narrow screens. */
export default function Split({
  kicker, title, body, media, flip,
}: {
  kicker?: string; title: ReactNode; body?: ReactNode; media: ReactNode; flip?: boolean; nav?: string; notes?: string
}) {
  return (
    <div className="slide full">
      <div className={'split' + (flip ? ' flip' : '')}>
        <div className="split-body">
          <Reveal>
            {kicker && <div className="kicker" style={{ marginBottom: 14 }}>{kicker}</div>}
            <h2 className="headline" style={{ fontSize: 'clamp(32px,4.6vw,54px)' }}>{title}</h2>
            {body && <div className="lead" style={{ marginTop: 16 }}>{body}</div>}
          </Reveal>
        </div>
        <div className="split-media">{media}</div>
      </div>
    </div>
  )
}
