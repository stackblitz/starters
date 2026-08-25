import { useEffect, useRef, useState } from 'react';
import { useStore } from './store';
import { unlockShare, shareToken } from './share';

const fmtWait = (s: number) => {
  if (s >= 90) return `${Math.ceil(s / 60)} minutes`;
  return `${s} second${s === 1 ? '' : 's'}`;
};

/* What a visitor sees instead of the deck: a password prompt when they hold a
   protected link, and a dead end when that link is gone. Both are
   plain, focusable forms — this is the first thing a screen reader meets. */
export default function Gate() {
  const denied = useStore((s) => s.denied);
  const load = useStore((s) => s.load);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedFor, setLockedFor] = useState(0); // seconds left on a lockout
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  // count the lockout down so the message stays true while you look at it
  useEffect(() => {
    if (lockedFor <= 0) return;
    const t = setInterval(() => setLockedFor((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [lockedFor > 0]);

  if (denied === 'share-required' || !shareToken) {
    return (
      <main className="gate" role="main">
        <div className="gate-card">
          <h1 className="gate-title">This link is not active</h1>
          <p className="gate-body">
            {shareToken
              ? 'It was turned off, or replaced with a new one. Ask whoever owns the deck for a current link.'
              : 'This link is not a share link. The published site is the audience deck; ask the owner for an editor or presenter-console link.'}
          </p>
        </div>
      </main>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !password || lockedFor > 0) return;
    setBusy(true);
    setError(null);
    const res = await unlockShare(password);
    if (!res.ok) {
      if (res.reason === 'throttled') {
        setLockedFor(res.retryAfter);
        setError(null);
      } else if (res.reason === 'offline') {
        setError(
          'Could not reach the deck. Check the connection and try again.'
        );
      } else {
        setError('That password does not open this link.');
        inputRef.current?.select();
      }
      setBusy(false);
      return;
    }
    setLockedFor(0);
    try {
      await load();
    } catch {
      setError('Unlocked, but the deck failed to load. Try again.');
    }
    setBusy(false);
  };

  return (
    <main className="gate" role="main">
      <form className="gate-card" onSubmit={submit}>
        <h1 className="gate-title">Password required</h1>
        <p className="gate-body" id="gate-help">
          This link is protected. Enter the password you were given.
        </p>
        <label className="gate-label" htmlFor="gate-pass">
          Password
        </label>
        <input
          id="gate-pass"
          ref={inputRef}
          className="gate-input"
          type="password"
          autoComplete="current-password"
          aria-describedby="gate-help"
          aria-invalid={!!error}
          aria-errormessage={error ? 'gate-error' : undefined}
          disabled={lockedFor > 0}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
        />
        {error && (
          <p className="gate-error" id="gate-error" role="alert">
            {error}
          </p>
        )}
        {lockedFor > 0 && (
          <p className="gate-error" role="alert">
            Too many attempts. This device is locked out for{' '}
            {fmtWait(lockedFor)}.
          </p>
        )}
        <button
          className="solid-btn gate-submit"
          type="submit"
          disabled={busy || !password || lockedFor > 0}
        >
          {lockedFor > 0
            ? `Locked (${fmtWait(lockedFor)})`
            : busy
            ? 'Checking…'
            : 'Open deck'}
        </button>
      </form>
    </main>
  );
}
