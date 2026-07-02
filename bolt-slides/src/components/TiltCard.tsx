import { useRef, useState, type CSSProperties, type ReactNode } from 'react'

/* Mouse-tracked 3D tilt + glare. Wrap one hero visual per slide. */
export default function TiltCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({})

  function move(e: React.MouseEvent) {
    const r = ref.current!.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    setStyle({
      transform: `perspective(1200px) rotateX(${(-py * 6).toFixed(2)}deg) rotateY(${(px * 9).toFixed(2)}deg)`,
      ['--gx' as string]: `${((px + 0.5) * 100).toFixed(1)}%`,
      ['--gy' as string]: `${((py + 0.5) * 100).toFixed(1)}%`,
    } as CSSProperties)
  }

  return (
    <div ref={ref} className="tilt" style={style} onMouseMove={move} onMouseLeave={() => setStyle({})}>
      {children}
      <span className="tilt-glare" />
    </div>
  )
}
