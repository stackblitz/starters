import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/data/store';

/* Sharing means sharing the published deck.

   The address this editor is running on cannot be opened by anyone else — in a
   preview it is a container URL bound to this one tab, and on a laptop it is
   localhost — so a link built from it is a link to nothing. The published site
   is the only address worth copying, which is why the deck records it and why
   Share stays closed until it does.

   What a published deck can enforce is nothing: it is a static build of the
   slides with no server behind it (server/snapshot.mjs). So there is one kind
   of link here — public, read only — rather than the per-mode links and
   passwords a backend could check. Those come back with docs/cloud-setup.md.

   The dialog is a focus trap with Escape to close, every control labelled, and
   every result announced in a live region. */

const LINKS: {
  id: string;
  title: string;
  body: string;
  path: string;
  warn?: string;
}[] = [
  {
    id: 'present',
    title: 'Presentation',
    body: 'The deck, full screen. Nobody can edit it.',
    path: '/present',
  },
  {
    id: 'presenter',
    title: 'Presenter console',
    body: 'Current and next slide, speaker notes, timer.',
    path: '/present?presenter=1',
    warn: 'Speaker notes are built into the published deck, so anyone who has this link can read them — including anyone who has the presentation link and edits it to match.',
  },
];

/* The stored form: an origin and nothing else. Same rule the server applies, so
   a URL accepted here is not rejected on save. */
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
  site,
  announce,
}: {
  spec: (typeof LINKS)[number];
  site: string;
  announce: (msg: string) => void;
}) {
  const url = site + spec.path;

  return (
    <li className="share-row">
      <div className="share-row-head">
        <div>
          <h3 className="share-row-title">{spec.title}</h3>
          <p className="share-row-body">{spec.body}</p>
        </div>
      </div>
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
                  announce('Copy failed. Select the link and copy it manually.')
              )
            }
          >
            Copy
          </button>
        </div>
        {spec.warn && <p className="share-hint">{spec.warn}</p>}
      </div>
    </li>
  );
}

export default function ShareModal({ onClose }: { onClose: () => void }) {
  const site = useStore((s) => s.deck.publish_url) ?? '';
  const updateDeck = useStore((s) => s.updateDeck);

  const [draft, setDraft] = useState(site);
  const [message, setMessage] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(
    typeof document !== 'undefined' ? document.activeElement : null
  );

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

  const save = () => {
    const next = siteOrigin(draft);
    if (!next) {
      setMessage('That is not a site address. It should look like https://…');
      return;
    }
    updateDeck({ publish_url: next });
    setDraft(next);
    setMessage(`Links now point at ${next}`);
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
          These links point at the published deck, so they keep working for
          whoever you send them to. They show the deck as it was last published
          — publish again after editing.
        </p>

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
                  if (e.key === 'Enter') save();
                }}
              />
              <button
                className="ghost-btn xs"
                disabled={!draft.trim() || draft.trim() === site}
                onClick={save}
              >
                Save
              </button>
            </div>
            <p className="share-hint">
              Filled in when the project is published. Change it here if the
              project moves — a renamed subdomain, a domain of your own.
            </p>
          </div>
        </div>

        {site ? (
          <ul className="share-list">
            {LINKS.map((spec) => (
              <Row
                key={spec.id}
                spec={spec}
                site={site}
                announce={setMessage}
              />
            ))}
          </ul>
        ) : (
          <p className="share-intro">
            Publish the project to get a link worth sending.
          </p>
        )}

        <p className="share-foot">
          A published deck is a static build with no server behind it, so a link
          cannot be made private, password protected, or editable. Moving the
          deck onto a backend (docs/cloud-setup.md) is what buys access control.
        </p>

        <p className="share-live" role="status" aria-live="polite">
          {message}
        </p>
      </div>
    </div>
  );
}
