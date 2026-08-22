/* Owner proof for deck-api. Not a VITE_ var — those bake into the published
   bundle. Proof arrives from Bolt's injected preview script (parent → iframe)
   or, in `vite dev` only, from `/.bolt/owner-proof`. Top-level bolt.host has
   neither, so the API sees no header and requires ?k=. */

declare global {
  interface Window {
    __BOLT_OWNER_PROOF?: string | null;
  }
}

export const OWNER_PROOF_EVENT = 'bolt:owner-proof';

export function ownerHeaders(): Record<string, string> {
  const token = window.__BOLT_OWNER_PROOF;
  if (typeof token === 'string' && token.length > 0) {
    return { 'x-deck-owner': token };
  }
  return {};
}

export function applyOwnerProof(token: string | null): void {
  window.__BOLT_OWNER_PROOF = token;
  window.dispatchEvent(
    new CustomEvent(OWNER_PROOF_EVENT, { detail: token })
  );
}

/** Wait for Bolt's broadcast, then fall back to the Vite serve endpoint. */
export async function bootOwnerProof(): Promise<void> {
  if (typeof window.__BOLT_OWNER_PROOF === 'string' && window.__BOLT_OWNER_PROOF) {
    return;
  }
  if (!import.meta.env.DEV) return;
  try {
    const res = await fetch('/.bolt/owner-proof');
    if (!res.ok) return;
    const body = (await res.json()) as { token?: string | null };
    if (typeof body.token === 'string' && body.token) applyOwnerProof(body.token);
  } catch {
    /* published static host has no such route */
  }
}
