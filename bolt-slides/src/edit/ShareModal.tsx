import { useCallback, useEffect, useRef, useState } from 'react';
import type { ShareLink, ShareMode } from '../data/share';
import { api } from '../data/store';
import { IconClose } from '../deck/icons';
import { useDialogTrap } from './useDialogTrap';

/* Share links, one per mode. Each row makes a link, optionally behind a
   password, and copies it. Turning a link off kills it everywhere at once.

   The dialog is a focus trap with Escape to close, every control labelled,
   and each row announcing its result in a live region below the card. The
   Share button is disabled until a public origin exists, so this dialog
   always has one. The published origin itself is the audience deck — these
   links are only the presenter console and the editor. */

const MODES: {
  id: ShareMode;
  title: string;
  body: string;
  path: (t: string) => string;
}[] = [
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
];

const MIN_PASSWORD = 8;

function Row({
  spec,
  link,
  origin,
  onSave,
  onStop,
}: {
  spec: (typeof MODES)[number];
  link?: ShareLink;
  origin: string;
  onSave: (
    mode: ShareMode,
    patch: { password?: string | null; rotate?: boolean }
  ) => Promise<void>;
  onStop: (mode: ShareMode) => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const on = !!link;
  const url = link ? origin + spec.path(link.token) : '';
  const passId = `share-pass-${spec.id}`;

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await fn();
      setMessage(done);
    } catch {
      setMessage('That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="share-item">
      <div className="share-row">
        <div className="share-row-head">
          <div>
            <h3 className="share-row-title">
              {spec.title}
              {link?.hasPassword && (
                <span className="share-lock">Password</span>
              )}
            </h3>
            <p className="share-row-body">{spec.body}</p>
          </div>
          <button
            className={'share-toggle' + (on ? ' on' : '')}
            role="switch"
            aria-checked={on}
            aria-label={`Share the ${spec.title.toLowerCase()}`}
            disabled={busy}
            onClick={() =>
              on
                ? run(() => onStop(spec.id), `${spec.title} link turned off`)
                : run(() => onSave(spec.id, {}), `${spec.title} link created`)
            }
          >
            <span className="share-toggle-knob" />
          </button>
        </div>

        {on && (
          <div className="share-row-body-open">
            <div className="share-link">
              <input
                className="share-url"
                readOnly
                value={url}
                aria-label={`${spec.title} link`}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                className="ghost-btn xs"
                disabled={!url}
                onClick={() =>
                  navigator.clipboard.writeText(url).then(
                    () => setMessage('Link copied'),
                    () =>
                      setMessage(
                        'Copy failed. Select the link and copy it manually.'
                      )
                  )
                }
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
                  className={
                    'share-input' + (link?.hasPassword ? ' is-dots' : '')
                  }
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
                  onClick={() =>
                    run(async () => {
                      await onSave(spec.id, { password });
                      setPassword('');
                    }, 'Password set. Anyone already in has been signed out')
                  }
                >
                  Set
                </button>
                {link?.hasPassword && (
                  <button
                    className="ghost-btn xs"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => onSave(spec.id, { password: null }),
                        'Password removed. The link is open again'
                      )
                    }
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
              onClick={() =>
                run(
                  () => onSave(spec.id, { rotate: true }),
                  'New link generated. The old one no longer works'
                )
              }
            >
              Generate a new link
            </button>
          </div>
        )}
      </div>
      <p
        className={'share-live' + (message ? ' on' : '')}
        role="status"
        aria-live="polite"
      >
        {message}
      </p>
    </li>
  );
}

export default function ShareModal({
  origin,
  onClose,
}: {
  origin: string;
  onClose: () => void;
}) {
  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useDialogTrap(ref, onClose);

  const refresh = useCallback(async () => setLinks(await api('/shares')), []);
  useEffect(() => {
    refresh().catch(() => setLinks([]));
  }, [refresh]);

  const onSave = async (
    mode: ShareMode,
    patch: { password?: string | null; rotate?: boolean }
  ) => {
    await api('/shares/' + mode, 'PUT', patch);
    await refresh();
  };
  const onStop = async (mode: ShareMode) => {
    await api('/shares/' + mode, 'DELETE');
    await refresh();
  };

  return (
    <div
      className="share-overlay"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="share-modal"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
      >
        <div className="share-head">
          <h2 id="share-title" className="share-title">
            Share this deck
          </h2>
          <button
            type="button"
            className="icon-btn"
            data-tip="Close"
            aria-label="Close"
            onClick={onClose}
          >
            <IconClose />
          </button>
        </div>
        <p className="share-intro">
          The published site is the audience deck. Use these links for the
          presenter console or to let someone else edit. Optional password.
        </p>

        {links === null ? (
          <p className="share-intro">Loading links…</p>
        ) : (
          <ul className="share-list">
            {MODES.map((spec) => (
              <Row
                key={spec.id}
                spec={spec}
                link={links.find((l) => l.mode === spec.id)}
                origin={origin}
                onSave={onSave}
                onStop={onStop}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
