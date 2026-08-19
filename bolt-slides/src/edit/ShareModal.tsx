import { useCallback, useEffect, useRef, useState } from 'react'
import type { ShareLink, ShareMode } from '@/data/share'

/* Share links, one per mode. Each row makes a link, optionally behind a
   password, and copies it. Turning a link off kills it everywhere at once.

   The dialog is a focus trap with Escape to close, every control labelled,
   and every result announced in a live region. */

const MODES: { id: ShareMode; title: string; body: string; path: (t: string) => string }[] = [
  {
    id: 'present',
    title: 'Presentation',
    body: 'The deck, full screen. Read only: no editing, no notes.',
    path: (t) => `/present?k=${t}`,
  },
  {
    id: 'presenter',
    title: 'Presenter console',
    body: 'Current and next slide, notes, timer. Can edit speaker notes, nothing else.',
    path: (t) => `/present?presenter=1&k=${t}`,
  },
  {
    id: 'edit',
    title: 'Editor',
    body: 'The full editor. Anyone with this link can change the deck.',
    path: (t) => `/?k=${t}`,
  },
]

const MIN_PASSWORD = 8

const api = async (path: string, method = 'GET', body?: unknown) => {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(String(res.status))
  return res.json()
}

function Row({
  spec, link, onSave, onStop, announce,
}: {
  spec: (typeof MODES)[number]
  link?: ShareLink
  onSave: (mode: ShareMode, patch: { password?: string | null; rotate?: boolean }) => Promise<void>
  onStop: (mode: ShareMode) => Promise<void>
  announce: (msg: string) => void
}) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const on = !!link
  const url = link ? window.location.origin + spec.path(link.token) : ''
  const passId = `share-pass-${spec.id}`

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true)
    try { await fn(); announce(done) } catch { announce('That did not work. Try again.') } finally { setBusy(false) }
  }

  return (
    <li className="share-row">
      <div className="share-row-head">
        <div>
          <h3 className="share-row-title">
            {spec.title}
            {link?.hasPassword && <span className="share-lock">Password</span>}
          </h3>
          <p className="share-row-body">{spec.body}</p>
        </div>
        <button
          className={'share-toggle' + (on ? ' on' : '')}
          role="switch"
          aria-checked={on}
          aria-label={`Share the ${spec.title.toLowerCase()}`}
          disabled={busy}
          onClick={() => (on
            ? run(() => onStop(spec.id), `${spec.title} link turned off`)
            : run(() => onSave(spec.id, {}), `${spec.title} link created`))}
        >
          <span className="share-toggle-knob" />
        </button>
      </div>

      {on && (
        <div className="share-row-body-open">
          <div className="share-link">
            <input className="share-url" readOnly value={url} aria-label={`${spec.title} link`} onFocus={(e) => e.currentTarget.select()} />
            <button
              className="ghost-btn xs"
              onClick={() => navigator.clipboard.writeText(url).then(
                () => announce('Link copied'),
                () => announce('Copy failed. Select the link and copy it manually.'),
              )}
            >
              Copy
            </button>
          </div>

          <div className="share-pass">
            <label className="share-pass-label" htmlFor={passId}>
              {link?.hasPassword ? 'Change password' : 'Add a password'}
            </label>
            <div className="share-pass-row">
              <input
                id={passId}
                className={'share-input' + (link?.hasPassword ? ' is-dots' : '')}
                type="password"
                autoComplete="new-password"
                /* a set password reads as dots, so "protected" is visible
                   without pretending we could show the password itself */
                placeholder={link?.hasPassword ? '••••••••' : 'No password'}
                value={password}
                disabled={busy}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                className="ghost-btn xs"
                disabled={busy || password.length < MIN_PASSWORD}
                onClick={() => run(async () => { await onSave(spec.id, { password }); setPassword('') }, 'Password set. Anyone already in has been signed out')}
              >
                Set
              </button>
              {link?.hasPassword && (
                <button
                  className="ghost-btn xs"
                  disabled={busy}
                  onClick={() => run(() => onSave(spec.id, { password: null }), 'Password removed. The link is open again')}
                >
                  Remove
                </button>
              )}
            </div>
            <p className="share-hint">
              {password && password.length < MIN_PASSWORD
                ? `At least ${MIN_PASSWORD} characters. A short password is guessable even with the rate limit.`
                : link?.hasPassword
                  ? 'Protected. Visitors are asked once, then remembered on that device for 30 days.'
                  : 'Open. Anyone with the link gets in.'}
            </p>
          </div>

          <button
            className="ghost-btn xs share-rotate"
            disabled={busy}
            onClick={() => run(() => onSave(spec.id, { rotate: true }), 'New link generated. The old one no longer works')}
          >
            Generate a new link
          </button>
        </div>
      )}
    </li>
  )
}

export default function ShareModal({ onClose }: { onClose: () => void }) {
  const [links, setLinks] = useState<ShareLink[] | null>(null)
  const [message, setMessage] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const opener = useRef<Element | null>(typeof document !== 'undefined' ? document.activeElement : null)

  const refresh = useCallback(async () => setLinks(await api('/shares')), [])
  useEffect(() => { refresh().catch(() => setLinks([])) }, [refresh])

  // focus trap + Escape, and focus returns to the button that opened this
  useEffect(() => {
    const root = ref.current
    root?.querySelector<HTMLElement>('button, input')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
      if (e.key !== 'Tab' || !root) return
      const f = Array.from(root.querySelectorAll<HTMLElement>('button, input, [href]')).filter((el) => !el.hasAttribute('disabled'))
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      ;(opener.current as HTMLElement | null)?.focus?.()
    }
  }, [onClose])

  const onSave = async (mode: ShareMode, patch: { password?: string | null; rotate?: boolean }) => {
    await api('/shares/' + mode, 'PUT', patch)
    await refresh()
  }
  const onStop = async (mode: ShareMode) => {
    await api('/shares/' + mode, 'DELETE')
    await refresh()
  }

  return (
    <div className="share-overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="share-modal" ref={ref} role="dialog" aria-modal="true" aria-labelledby="share-title">
        <div className="share-head">
          <h2 id="share-title" className="share-title">Share this deck</h2>
          <button className="ghost-btn xs" onClick={onClose} aria-label="Close share dialog">Done</button>
        </div>
        <p className="share-intro">
          Links work wherever this deck is reachable: your network, or a tunnel you expose. You always have full access from this machine.
        </p>

        {links === null
          ? <p className="share-intro">Loading links…</p>
          : (
            <ul className="share-list">
              {MODES.map((spec) => (
                <Row
                  key={spec.id}
                  spec={spec}
                  link={links.find((l) => l.mode === spec.id)}
                  onSave={onSave}
                  onStop={onStop}
                  announce={setMessage}
                />
              ))}
            </ul>
          )}

        <p className="share-live" role="status" aria-live="polite">{message}</p>
      </div>
    </div>
  )
}
