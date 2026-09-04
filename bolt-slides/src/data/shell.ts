export function isPresenterRoute(): boolean {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/present') return true;
  return new URLSearchParams(window.location.search).has('presenter');
}

export function isPresentRoute(): boolean {
  return new URLSearchParams(window.location.search).has('present');
}

export function isStudioShell(): boolean {
  if (window.parent !== window) return true;
  return import.meta.env.DEV;
}

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
