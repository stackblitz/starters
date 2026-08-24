/* Public origin for Share links. Bolt injects the published bolt.host origin
   into the preview iframe. Local Vite and a top-level published site have no
   parent, so they mint on location.origin. A Bolt preview with no live deploy
   must not copy a WebContainer URL. */

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    __BOLT_PUBLISHED_ORIGIN?: string | null;
  }
}

export const PUBLISHED_ORIGIN_EVENT = 'bolt:published-origin';

export type ShareOrigin = {
  origin: string | null;
  canCopy: boolean;
};

export function pageOrigin(): string {
  return window.location.origin.replace(/\/$/, '');
}

export function shareOrigin(): ShareOrigin {
  if ('__BOLT_PUBLISHED_ORIGIN' in window) {
    const injected = window.__BOLT_PUBLISHED_ORIGIN;
    if (typeof injected === 'string' && injected.length > 0) {
      return { origin: injected.replace(/\/$/, ''), canCopy: true };
    }
    return { origin: null, canCopy: false };
  }
  if (window.parent !== window) {
    return { origin: null, canCopy: false };
  }
  return { origin: window.location.origin, canCopy: true };
}

/** This window is already the public (or local) origin. A Bolt preview iframe
 *  is a WebContainer URL even after publish — don't open or copy it. */
export function isShareablePage(): boolean {
  const { origin, canCopy } = shareOrigin();
  return canCopy && origin === pageOrigin();
}

export function useShareOrigin(): ShareOrigin {
  const [, setTick] = useState(0);
  useEffect(() => {
    const onChange = () => setTick((n) => n + 1);
    window.addEventListener(PUBLISHED_ORIGIN_EVENT, onChange);
    return () => window.removeEventListener(PUBLISHED_ORIGIN_EVENT, onChange);
  }, []);
  return shareOrigin();
}
