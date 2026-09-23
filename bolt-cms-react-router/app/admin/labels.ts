/** Human labels for post types and taxonomies, WordPress-style. */

const TYPE_LABELS: Record<string, [string, string]> = {
  post: ['Post', 'Posts'],
  page: ['Page', 'Pages'],
  product: ['Product', 'Products'],
  attachment: ['Attachment', 'Attachments'],
};

const TAXONOMY_LABELS: Record<string, [string, string]> = {
  category: ['Category', 'Categories'],
  post_tag: ['Tag', 'Tags'],
  product_cat: ['Product category', 'Product categories'],
  product_tag: ['Product tag', 'Product tags'],
};

export function typeLabel(type: string, plural = false): string {
  const known = TYPE_LABELS[type];
  if (known) return plural ? known[1] : known[0];
  const base = humanize(type);
  return plural ? pluralizeWord(base) : base;
}

export function taxonomyLabel(taxonomy: string, plural = false): string {
  const known = TAXONOMY_LABELS[taxonomy];
  if (known) return plural ? known[1] : known[0];
  const base = humanize(taxonomy);
  return plural ? pluralizeWord(base) : base;
}

export function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function pluralizeWord(word: string): string {
  if (/y$/i.test(word) && !/[aeiou]y$/i.test(word))
    return word.replace(/y$/i, 'ies');
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  return `${word}s`;
}

/** Which taxonomies attach to a post type. Mirrors WordPress defaults. */
export function taxonomiesForType(type: string, all: string[]): string[] {
  if (type === 'post')
    return all.filter((t) => t === 'category' || t === 'post_tag');
  if (type === 'page') return [];
  // Custom types: taxonomies that share their prefix (product -> product_cat),
  // falling back to every non-core taxonomy.
  const prefixed = all.filter(
    (t) => t.startsWith(`${type}_`) || t.startsWith(`${type}-`)
  );
  if (prefixed.length) return prefixed;
  return all.filter((t) => t !== 'category' && t !== 'post_tag');
}
