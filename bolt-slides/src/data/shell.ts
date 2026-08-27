/* Studio vs audience vs presenter console.
   Studio: Bolt preview iframe, or local `npm run dev` (top-level Vite).
   Audience: production top-level `/` (published site).
   Console: `/present` or `?presenter=1`. */

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
