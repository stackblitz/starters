import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from '@/data/backend';
import { useStore } from '@/data/store';
import type { ShareLink, Visibility } from '@/data/types';
import type { ShareMode } from '@/data/share';

/* Share links, one per mode. Each row makes a link, optionally behind a
   password, and copies it. Turning a link off kills it everywhere at once.

   Every link is built on the deck's published address, never on the address
   this editor happens to be running at. In a Bolt preview that address belongs
   to the one tab connected to the project and opens for nobody else, and on a
   laptop it is localhost — so a link built from it is a link to nothing, which
   is exactly the bug that made sharing look broken. The published deck reports
   its own address the first time anyone loads it, so this is normally filled in
   already; the field is here for correcting it.

   The dialog is a focus trap with Escape to close, every control labelled,
   and every result announced in a live region. */

const MODES: {
  id: ShareMode;
  title: string;
  body: string;
  path: (t: string) => string;
}[] = [
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
];

const MIN_PASSWORD = 8;

/* The stored form: an origin and nothing else, since the deck appends its own
   paths. Same rule the deck function applies, so a URL accepted here is not
   rejected on save. */
function siteOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

function Row({
  spec,
  link,
  site,
  onSave,
  onStop,
  announce,
}: {
  spec: (typeof MODES)[number];
  link?: ShareLink;
  site: string;
  onSave: (
    mode: ShareMode,
    patch: { password?: string | null; rotate?: boolean }
  ) => Promise<void>;
  onStop: (mode: ShareMode) => Promise<void>;
  announce: (msg: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const on = !!link;
  const url = link ? site + spec.path(link.token) : '';
  const passId = `share-pass-${spec.id}`;

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await fn();
      announce(done);
    } catch {
      announce('That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

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
              onClick={() =>
                navigator.clipboard.writeText(url).then(
                  () => announce('Link copied'),
                  () =>
                    announce(
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
    </li>
  );
}

export default function ShareModal({ onClose }: { onClose: () => void }) {
  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const [message, setMessage] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(
    typeof document !== 'undefined' ? document.activeElement : null
  );

  const site = useStore((s) => s.deck.publish_url) ?? '';
  const visibility = useStore((s) => s.deck.visibility) ?? 'public';
  const updateDeck = useStore((s) => s.updateDeck);
  const [draft, setDraft] = useState(site);
  useEffect(() => setDraft(site), [site]);

  const refresh = useCallback(
    async () => setLinks(await request<ShareLink[]>('/shares')),
    []
  );
  useEffect(() => {
    refresh().catch(() => setLinks([]));
  }, [refresh]);

  // focus trap + Escape, and focus returns to the button that opened this
  useEffect(() => {
    const root = ref.current;
    root?.querySelector<HTMLElement>('button, input')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !root) return;
      const f = Array.from(
        root.querySelectorAll<HTMLElement>('button, input, [href]')
      ).filter((el) => !el.hasAttribute('disabled'));
      if (!f.length) return;
      const first = f[0],
        last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  const onSave = async (
    mode: ShareMode,
    patch: { password?: string | null; rotate?: boolean }
  ) => {
    await request('/shares/' + mode, 'PUT', patch);
    await refresh();
  };
  const onStop = async (mode: ShareMode) => {
    await request('/shares/' + mode, 'DELETE');
    await refresh();
  };

  const savePublishUrl = () => {
    const next = siteOrigin(draft);
    if (!next) {
      setMessage('That is not a site address. It should look like https://…');
      return;
    }
    updateDeck({ publish_url: next });
    setDraft(next);
    setMessage(`Links now point at ${next}`);
  };

  const setVisibility = (next: Visibility) => {
    updateDeck({ visibility: next });
    setMessage(
      next === 'public'
        ? 'Anyone who opens the published deck can read the slides'
        : 'The published deck now shows nothing without a link'
    );
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
            className="ghost-btn xs"
            onClick={onClose}
            aria-label="Close share dialog"
          >
            Done
          </button>
        </div>
        <p className="share-intro">
          These links open the published deck, so they keep working for whoever
          you send them to. The deck they show is live: an edit here is an edit
          there, with no need to publish again.
        </p>

        <div className="share-row">
          <div className="share-row-head">
            <div>
              <h3 className="share-row-title">Anyone with the address</h3>
              <p className="share-row-body">
                {visibility === 'public'
                  ? 'Opening the published deck shows the slides. Speaker notes are never included.'
                  : 'The published deck shows nothing without one of the links below.'}
              </p>
            </div>
            <button
              className={
                'share-toggle' + (visibility === 'public' ? ' on' : '')
              }
              role="switch"
              aria-checked={visibility === 'public'}
              aria-label="Let anyone with the address read the deck"
              onClick={() =>
                setVisibility(visibility === 'public' ? 'link' : 'public')
              }
            >
              <span className="share-toggle-knob" />
            </button>
          </div>
        </div>

        <div className="share-row">
          <label className="share-row-title" htmlFor="share-site">
            Published at
          </label>
          <div className="share-row-body-open">
            <div className="share-link">
              <input
                id="share-site"
                className="share-input"
                type="url"
                inputMode="url"
                placeholder="https://your-deck.bolthost.dev"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') savePublishUrl();
                }}
              />
              <button
                className="ghost-btn xs"
                disabled={!draft.trim() || draft.trim() === site}
                onClick={savePublishUrl}
              >
                Save
              </button>
            </div>
            <p className="share-hint">
              Filled in the first time the published deck is opened. Change it
              here if the project moves — a renamed subdomain, or a domain of
              your own.
            </p>
          </div>
        </div>

        {!site ? (
          <p className="share-intro">
            Publish the project to get links worth sending. The address this
            editor is running on opens for nobody else.
          </p>
        ) : links === null ? (
          <p className="share-intro">Loading links…</p>
        ) : (
          <ul className="share-list">
            {MODES.map((spec) => (
              <Row
                key={spec.id}
                spec={spec}
                site={site}
                link={links.find((l) => l.mode === spec.id)}
                onSave={onSave}
                onStop={onStop}
                announce={setMessage}
              />
            ))}
          </ul>
        )}

        <p className="share-live" role="status" aria-live="polite">
          {message}
        </p>
      </div>
    </div>
  );
}
