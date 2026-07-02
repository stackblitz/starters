import { Fragment, type ReactNode } from 'react'

/* A macOS-style code window with line numbers, restrained syntax tinting, and
   optional line highlighting. Highlighting is intentionally minimal (keywords,
   strings, comments) to stay on-brand — one accent, no rainbow.
   <CodeWindow title="server.ts" highlight={[3]} code={`…`} /> */
const KW = /\b(const|let|var|function|return|if|else|for|while|import|from|export|default|class|new|await|async|type|interface|extends|implements|public|private|true|false|null|undefined)\b/g

function hl(line: string): ReactNode {
  // split off a trailing line comment
  const ci = line.indexOf('//')
  const code = ci >= 0 ? line.slice(0, ci) : line
  const comment = ci >= 0 ? line.slice(ci) : ''
  // strings first (odd indices), then keywords inside the rest
  const segs = code.split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g)
  return (
    <>
      {segs.map((seg, i) =>
        i % 2 === 1
          ? <span key={i} className="cw-str">{seg}</span>
          : <Fragment key={i}>{seg.split(KW).map((s, j) => (j % 2 === 1 ? <span key={j} className="cw-kw">{s}</span> : s))}</Fragment>,
      )}
      {comment && <span className="cw-com">{comment}</span>}
    </>
  )
}

export default function CodeWindow({ title = 'app.tsx', code, highlight = [] }: { title?: string; code: string; highlight?: number[] }) {
  const lines = code.replace(/\n$/, '').split('\n')
  return (
    <div className="cw">
      <div className="cw-bar">
        <span className="cw-dots"><i /><i /><i /></span>
        <span className="cw-title">{title}</span>
      </div>
      <pre className="cw-body"><code>
        {lines.map((ln, i) => (
          <div key={i} className={'cw-line' + (highlight.includes(i + 1) ? ' hl' : '')}>
            <span className="cw-no">{i + 1}</span>
            <span className="cw-code">{ln.length ? hl(ln) : ' '}</span>
          </div>
        ))}
      </code></pre>
    </div>
  )
}
