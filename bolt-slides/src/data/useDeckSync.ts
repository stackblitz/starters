import { useEffect } from 'react';
import { useStore } from './store';
import { subscribeDeckChanges } from './realtime';

/** Load once, then re-fetch as soon as deck-api broadcasts a write (agent
 *  import, other windows). Focus/visibility is a fallback if a ping is missed. */
export function useDeckSync({ enabled = true }: { enabled?: boolean } = {}) {
  const load = useStore((s) => s.load);
  const refresh = useStore((s) => s.refresh);
  const loaded = useStore((s) => s.loaded);

  useEffect(() => {
    if (!enabled) return;
    load().catch(() => {
      /* the gate / bootError explains why */
    });
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled || !loaded) return;
    const pull = () => {
      refresh().catch(() => {
        /* keep last good state */
      });
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') pull();
    };
    window.addEventListener('focus', onVis);
    document.addEventListener('visibilitychange', onVis);
    const unsubscribe = subscribeDeckChanges(pull);
    return () => {
      window.removeEventListener('focus', onVis);
      document.removeEventListener('visibilitychange', onVis);
      unsubscribe();
    };
  }, [enabled, loaded, refresh]);
}
