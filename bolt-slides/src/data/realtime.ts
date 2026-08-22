/* Realtime ping from deck-api after a write — not table replication.
   Tables stay RLS-locked; this is a public broadcast that only means
   "re-fetch /state". */
import { createClient } from '@supabase/supabase-js';

export const DECK_CHANNEL = 'deck';
export const DECK_EVENT = 'change';

export function subscribeDeckChanges(onChange: () => void): () => void {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) return () => undefined;

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const channel = supabase
    .channel(DECK_CHANNEL)
    .on('broadcast', { event: DECK_EVENT }, () => onChange())
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
