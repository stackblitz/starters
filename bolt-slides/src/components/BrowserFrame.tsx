import type { ReactNode } from 'react';

/* Wrap a screenshot or UI mock in browser chrome — traffic dots, back/forward
   arrows, and a padlocked URL pill. children fill the body: an <img>, a
   <VisualDashboard/>, anything.
   <BrowserFrame url="app.acme.com"><img …/></BrowserFrame> */
const Arrow = ({ back }: { back?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {back ? <path d="M15 6l-6 6 6 6" /> : <path d="M9 6l6 6-6 6" />}
  </svg>
);

const Lock = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.4}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="5" y="11" width="14" height="9" rx="2.2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export default function BrowserFrame({
  url = 'app.acme.com',
  children,
}: {
  url?: string;
  children: ReactNode;
}) {
  return (
    <div className="bf mat">
      <div className="bf-bar">
        <span className="bf-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="bf-nav" aria-hidden>
          <Arrow back />
          <Arrow />
        </span>
        <span className="bf-url">
          <Lock />
          {url}
        </span>
        <span style={{ width: 52, flexShrink: 0 }} aria-hidden />
      </div>
      <div className="bf-body">{children}</div>
    </div>
  );
}
