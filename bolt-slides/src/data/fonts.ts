interface FontPairing {
  id: string;
  label: string;
  head: string;
  body: string;
  /** Google Fonts stylesheet URL; absent = bundled default */
  import?: string;
}

const g = (families: string[]) =>
  'https://fonts.googleapis.com/css2?' +
  families
    .map((f) => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700`)
    .join('&') +
  '&display=swap';

const FONTS: FontPairing[] = [
  { id: 'inter', label: 'Inter', head: 'Inter', body: 'Inter' },
  {
    id: 'space',
    label: 'Space Grotesk',
    head: 'Space Grotesk',
    body: 'Inter',
    import: g(['Space Grotesk', 'Inter']),
  },
  {
    id: 'sora',
    label: 'Sora',
    head: 'Sora',
    body: 'Inter',
    import: g(['Sora', 'Inter']),
  },
  {
    id: 'manrope',
    label: 'Manrope',
    head: 'Manrope',
    body: 'Manrope',
    import: g(['Manrope']),
  },
  {
    id: 'dm',
    label: 'DM Sans',
    head: 'DM Sans',
    body: 'DM Sans',
    import: g(['DM Sans']),
  },
  {
    id: 'outfit',
    label: 'Outfit',
    head: 'Outfit',
    body: 'Inter',
    import: g(['Outfit', 'Inter']),
  },
  {
    id: 'playfair',
    label: 'Playfair Display',
    head: 'Playfair Display',
    body: 'Source Sans 3',
    import: g(['Playfair Display', 'Source Sans 3']),
  },
  {
    id: 'fraunces',
    label: 'Fraunces',
    head: 'Fraunces',
    body: 'Inter',
    import: g(['Fraunces', 'Inter']),
  },
];

export function applyFont(id: string | undefined) {
  const f = FONTS.find((x) => x.id === id) ?? FONTS[0];
  let link = document.getElementById('gfont') as HTMLLinkElement | null;

  if (f.import) {
    if (!link) {
      link = document.createElement('link');
      link.id = 'gfont';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }

    if (link.href !== f.import) link.href = f.import;
  } else {
    link?.remove();
  }

  const r = document.documentElement.style;

  r.setProperty(
    '--font-head',
    `'${f.head}', 'Inter', -apple-system, sans-serif`
  );
  r.setProperty(
    '--font-body',
    `'${f.body}', 'Inter', -apple-system, sans-serif`
  );
}

export function applyAccent(hex?: string | null) {
  const r = document.documentElement.style;

  if (hex) {
    r.setProperty('--accent', hex);
    r.setProperty('--primary', hex);
  } else {
    r.removeProperty('--accent');
    r.removeProperty('--primary');
  }
}
