import type { ReactNode } from 'react'

/* Wrap a screenshot or UI mock in browser chrome. children fill the body —
   an <img>, a <VisualDashboard/>, anything. <BrowserFrame url="app.acme.com"><img …/></BrowserFrame> */
export default function BrowserFrame({ url = 'app.acme.com', children }: { url?: string; children: ReactNode }) {
  return (
    <div className="bf">
      <div className="bf-bar">
        <span className="bf-dots"><i /><i /><i /></span>
        <span className="bf-url">{url}</span>
      </div>
      <div className="bf-body">{children}</div>
    </div>
  )
}
