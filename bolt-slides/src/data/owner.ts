/* Preview owner proof for deck-api. Not a VITE_ var — those bake into the
   published bundle. Bolt injects it into the preview iframe. Top-level
   bolt.host has no parent: that origin is the audience deck (present,
   notes stripped). Editor and presenter-console links still use ?k=. */

declare global {
  interface Window {
    __BOLT_OWNER_PROOF?: string | null;
  }
}

export const OWNER_PROOF_EVENT = 'bolt:owner-proof';

const IFRAME_WAIT_MS = 8_000;

export function hasOwnerProof(): boolean {
  const token = window.__BOLT_OWNER_PROOF;
  return typeof token === 'string' && token.length > 0;
}

export function ownerHeaders(): Record<string, string> {
  if (!hasOwnerProof()) return {};
  return { 'x-deck-owner': window.__BOLT_OWNER_PROOF as string };
}

export function applyOwnerProof(token: string | null): void {
  window.__BOLT_OWNER_PROOF = token;
  window.dispatchEvent(new CustomEvent(OWNER_PROOF_EVENT, { detail: token }));
}

/** Wait for Bolt's preview inject. Local Vite / published origin (no parent)
 *  continue immediately. Iframe waits for a non-empty token; a late inject
 *  still wins via OWNER_PROOF_EVENT even after this returns. */
export async function bootOwnerProof(signal?: AbortSignal): Promise<void> {
  if (hasOwnerProof() || window.parent === window || signal?.aborted) {
    return;
  }

  await new Promise<void>((resolve) => {
    const finish = () => {
      window.clearTimeout(timeout);
      window.removeEventListener(OWNER_PROOF_EVENT, onProof);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    const onProof = () => {
      if (hasOwnerProof()) finish();
    };
    const timeout = window.setTimeout(finish, IFRAME_WAIT_MS);
    window.addEventListener(OWNER_PROOF_EVENT, onProof);
    signal?.addEventListener('abort', finish);
    if (hasOwnerProof()) finish();
  });
}
