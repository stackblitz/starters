import { Link, useLocation } from 'react-router';

export function Pagination({ page, pages }: { page: number; pages: number }) {
  const location = useLocation();
  if (pages <= 1) return null;

  const href = (p: number) => {
    const params = new URLSearchParams(location.search);
    if (p <= 1) params.delete('page');
    else params.set('page', String(p));
    const qs = params.toString();
    return location.pathname + (qs ? `?${qs}` : '');
  };

  return (
    <nav
      className="mt-12 flex items-center justify-between border-t border-site-border pt-6 text-sm"
      aria-label="Pagination"
    >
      {page > 1 ? (
        <Link to={href(page - 1)} className="font-semibold no-underline">
          ← Newer posts
        </Link>
      ) : (
        <span />
      )}
      <span className="text-site-muted">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link to={href(page + 1)} className="font-semibold no-underline">
          Older posts →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
