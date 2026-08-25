/* Client side of share links.

   A shared link carries ?k=<token>. The token is remembered for this origin,
   sent on every API call, and — when the link has a password — exchanged once
   for a grant key that is remembered too. Owner access is X-Deck-Owner from
   Bolt preview, not "no token". The published origin without a token is the
   audience deck. */
import { deckUrl, supabaseAuthHeaders } from './api';

export type ShareMode = 'edit' | 'presenter' | 'present';
export interface ShareLink {
  mode: ShareMode;
  token: string;
  hasPassword: boolean;
}

const TOKEN_KEY = 'deck:share-token';
const GRANT_KEY = 'deck:share-grant';

const url = () => new URL(window.location.href);

/* Token from the link if there is one, else the one this TAB was opened with.
   It lives in sessionStorage on purpose: a share link governs the tab you
   opened it in and nothing else, so the owner opening a link to preview it
   never turns their other tabs into visitors. The grant (proof you knew the
   password) is kept longer, so the prompt is asked once per device. */
function readToken(): string | null {
  const fromUrl = url().searchParams.get('k');
  if (fromUrl) {
    const prev = sessionStorage.getItem(TOKEN_KEY);
    if (prev !== fromUrl) localStorage.removeItem(GRANT_KEY); // different link, different door
    sessionStorage.setItem(TOKEN_KEY, fromUrl);
    return fromUrl;
  }
  return sessionStorage.getItem(TOKEN_KEY);
}

export const shareToken = readToken();

export const shareHeaders = (): Record<string, string> => {
  const h: Record<string, string> = {};
  if (shareToken) h['x-share-token'] = shareToken;
  const grant = localStorage.getItem(GRANT_KEY);
  if (grant) h['x-share-grant'] = grant;
  return h;
};

/* keep ?k= on links the app builds itself (present → presenter, and back) */
export function withShare(path: string): string {
  if (!shareToken) return path;
  const [base, hash] = path.split('#');
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}k=${encodeURIComponent(shareToken)}${
    hash ? '#' + hash : ''
  }`;
}

/* Why an unlock failed matters to the person typing: a wrong password is
   worth retrying, a lockout is not. */
export type UnlockResult =
  | { ok: true }
  | { ok: false; reason: 'denied' }
  | { ok: false; reason: 'throttled'; retryAfter: number }
  | { ok: false; reason: 'offline' };

export async function unlockShare(password: string): Promise<UnlockResult> {
  if (!shareToken) return { ok: false, reason: 'denied' };
  let res: Response;
  try {
    res = await fetch(deckUrl('/share/unlock'), {
      method: 'POST',
      headers: {
        ...supabaseAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: shareToken, password }),
    });
  } catch {
    return { ok: false, reason: 'offline' };
  }

  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    const header = Number(res.headers.get('Retry-After'));
    return {
      ok: false,
      reason: 'throttled',
      retryAfter: body.retryAfter ?? (Number.isFinite(header) ? header : 600),
    };
  }
  if (!res.ok) return { ok: false, reason: 'denied' };
  const { key } = await res.json();
  localStorage.setItem(GRANT_KEY, key);
  return { ok: true };
}

/* what this link is, before we are allowed in (used by the password gate) */
export async function shareInfo(): Promise<{
  mode: ShareMode;
  hasPassword: boolean;
} | null> {
  if (!shareToken) return null;
  const res = await fetch(
    deckUrl('/share?token=' + encodeURIComponent(shareToken)),
    { headers: supabaseAuthHeaders() }
  );
  return res.ok ? res.json() : null;
}
