/* A continuously-scrolling strip — logo wall, value props, tech stack. */
export default function Marquee({ items, duration = 26 }: { items: string[]; duration?: number }) {
  return (
    <div className="marquee">
      <div className="marquee-track" style={{ animationDuration: `${duration}s` }}>
        {[...items, ...items].map((it, i) => (
          <span key={i} className="marquee-item">{it}</span>
        ))}
      </div>
    </div>
  )
}
