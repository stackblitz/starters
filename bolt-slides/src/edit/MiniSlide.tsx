/* A live thumbnail — renders the real slide at presentation size, scaled
   down (same trick as the engine's overview rail), fully static. */
import { useEffect, useRef, useState } from 'react'
import type { SlideData } from '../data/types'
import SlideView from '../slide/SlideView'

export default function MiniSlide({ slide }: { slide: SlideData }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [d, setD] = useState({ vw: 1280, vh: 720, scale: 0.14 })

  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const update = () => setD({ vw: window.innerWidth, vh: window.innerHeight, scale: el.clientWidth / window.innerWidth })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => { ro.disconnect(); window.removeEventListener('resize', update) }
  }, [])

  return (
    <div className="mini-frame" ref={frameRef} style={{ aspectRatio: `${d.vw} / ${d.vh}` }}>
      <div className="mini-scale" style={{ width: d.vw, height: d.vh, transform: `scale(${d.scale})` }}>
        <SlideView slide={slide} />
      </div>
    </div>
  )
}
