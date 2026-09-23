import { useMemo } from 'react';

import { sanitizeHtml } from '@/lib/sanitize';

/**
 * Render post HTML. `content_html` is WordPress' rendered markup (or the
 * editor's HTML export after editing in /admin), sanitized before insertion.
 * Styles for core WordPress block classes live in app/theme/tokens.css.
 */
export function PostContent({
  html,
  className = '',
}: {
  html: string | null | undefined;
  className?: string;
}) {
  const clean = useMemo(() => sanitizeHtml(html ?? ''), [html]);
  return (
    <div
      className={`entry-content ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
