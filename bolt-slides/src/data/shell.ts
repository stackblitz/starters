/* Studio vs audience vs presenter console.
   Studio: Bolt preview iframe, or local `npm run dev` (top-level Vite).
   Audience: production top-level `/` (published site).
   Console: `/present` or `?presenter=1`. */
import { useEffect, useState } from 'react';

const PUBLISHED_ORIGIN_EVENT = 'bolt:published-origin';

type BoltWindow = Window & { __BOLT_PUBLISHED_ORIGIN?: string | null };

export function isPresenterRoute(): boolean {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/present') return true;
  return new URLSearchParams(window.location.search).has('presenter');
}

export function isStudioShell(): boolean {
  if (isPresenterRoute()) return false;
  if (window.parent !== window) return true;
  return import.meta.env.DEV;
}

function readPublishedOrigin(): string | null {
  const v = (window as BoltWindow).__BOLT_PUBLISHED_ORIGIN;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export function isPreviewHostname(hostname: string): boolean {
  return (
    hostname.endsWith('.webcontainer-api.io') ||
    hostname.endsWith('.webcontainer.io') ||
    hostname.endsWith('.preview.bolt.host') ||
    hostname.includes('local-credentialless')
  );
}

function isLivePublishedOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      !isPreviewHostname(url.hostname)
    );
  } catch {
    return false;
  }
}

function isPreviewContext(): boolean {
  return (
    window.parent !== window || isPreviewHostname(window.location.hostname)
  );
}

/** Origin for dock P. Null → hide the control.
 *  Bolt preview: only a live published bolt.host (never the WC preview URL).
 *  Published audience (top-level production): this origin.
 *  Local Vite / unpublished preview: null. */
export function presenterLaunchOrigin(): string | null {
  if (isPresenterRoute()) return null;

  const published = readPublishedOrigin();
  if (published && isLivePublishedOrigin(published)) return published;

  if (isPreviewContext() || import.meta.env.DEV) return null;
  if (isPreviewHostname(window.location.hostname)) return null;

  return window.location.origin;
}

export function usePresenterLaunchOrigin(): string | null {
  const [origin, setOrigin] = useState<string | null>(() =>
    presenterLaunchOrigin()
  );
  useEffect(() => {
    const sync = () => setOrigin(presenterLaunchOrigin());
    window.addEventListener(PUBLISHED_ORIGIN_EVENT, sync);
    sync();
    return () => window.removeEventListener(PUBLISHED_ORIGIN_EVENT, sync);
  }, []);
  return origin;
}
