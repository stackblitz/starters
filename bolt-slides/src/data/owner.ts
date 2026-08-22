/* Owner proof for deck-api. Not a VITE_ var — those bake into the published
   bundle. Bolt injects it into the preview iframe. Top-level bolt.host has
   no parent, so the API sees no header and requires ?k=. */

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

/** Wait for Bolt's preview inject. Local Vite (no parent) continues immediately. */
export async function bootOwnerProof(): Promise<void> {
  if (typeof window.__BOLT_OWNER_PROOF === 'string' && window.__BOLT_OWNER_PROOF) {
    return;
  }
  if (window.parent === window) {
    return;
  }
  await new Promise<void>((resolve) => {
    const finish = () => {
      window.clearTimeout(timeout);
      window.removeEventListener(OWNER_PROOF_EVENT, finish);
      resolve();
    };
    const timeout = window.setTimeout(finish, 2000);
    window.addEventListener(OWNER_PROOF_EVENT, finish);
  });
}
