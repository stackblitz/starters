/* Deck API origin — the `deck-api` edge function. */

export function deckUrl(path: string): string {
  const base = (
    import.meta.env.VITE_SUPABASE_URL as string | undefined
  )?.replace(/\/$/, '');
  if (!base) {
    throw new Error('missing-supabase-url');
  }
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}/functions/v1/deck-api${suffix}`;
}

export function supabaseAuthHeaders(): Record<string, string> {
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!anon) {
    throw new Error('missing-supabase-anon-key');
  }
  return {
    Authorization: `Bearer ${anon}`,
    apikey: anon,
  };
}
