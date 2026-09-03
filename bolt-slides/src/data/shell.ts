/* Studio vs audience vs presenter console.
   Studio: Bolt preview iframe, or local `npm run dev` (top-level Vite).
   Audience: production top-level `/` (published site).
   Present from the studio: `?present=1` in a new tab (not fullscreen).
   Console: `/present` or `?presenter=1`, and only when presenter
   features are allowed (studio / DEV / the P popup's window.opener). */

export function isPresenterRoute(): boolean {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/present') return true;
  return new URLSearchParams(window.location.search).has('presenter');
}

/** Audience present opened from the studio Play control. Distinct from
    `?presenter=1` (the speaker console). */
export function isPresentRoute(): boolean {
  return new URLSearchParams(window.location.search).has('present');
}

export function isStudioShell(): boolean {
  if (window.parent !== window) return true;
  return import.meta.env.DEV;
}

/** Presenter console + dock P. Published top-level must stay false so
    speaker notes cannot open from the audience link. */
export function allowPresenterFeatures(): boolean {
  if (import.meta.env.DEV) return true;
  if (window.parent !== window) return true;
  if (window.opener) return true;
  return false;
}

export function openPresentWindow(slideIndex: number) {
  window.open(`/?present=1#${slideIndex + 1}`, 'deck-present');
}

export function openPresenterWindow(slideIndex: number) {
  window.open(`/?presenter=1#${slideIndex + 1}`, 'deck-presenter');
}
