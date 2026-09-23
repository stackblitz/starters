/**
 * Menu items imported from WordPress hold absolute URLs on the old host.
 * Anything on the imported site's domain (or a relative URL) becomes a local
 * path; everything else stays an external link.
 */
export function resolveMenuUrl(
  url: string,
  siteUrl: string
): { href: string; external: boolean } {
  if (!url || url === '#') return { href: '/', external: false };
  if (!/^https?:\/\//i.test(url)) {
    return { href: url.startsWith('/') ? url : `/${url}`, external: false };
  }
  try {
    const u = new URL(url);
    const hosts = new Set<string>();
    if (siteUrl) {
      try {
        hosts.add(new URL(siteUrl).host.replace(/^www\./, ''));
      } catch {
        /* ignore malformed site_url */
      }
    }
    if (typeof window !== 'undefined')
      hosts.add(window.location.host.replace(/^www\./, ''));
    if (hosts.has(u.host.replace(/^www\./, ''))) {
      return {
        href: (u.pathname.replace(/\/+$/, '') || '/') + u.search + u.hash,
        external: false,
      };
    }
    return { href: url, external: true };
  } catch {
    return { href: url, external: true };
  }
}
