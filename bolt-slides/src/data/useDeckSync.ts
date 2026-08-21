import { useEffect } from 'react';
import { useStore } from './store';

/** Load the deck once, then re-fetch when the tab is focused so agent
 *  imports (and edits from other windows) land in the visual preview. */
export function useDeckSync() {
  const load = useStore((s) => s.load);
  const refresh = useStore((s) => s.refresh);
  const loaded = useStore((s) => s.loaded);

  useEffect(() => {
    load().catch(() => {
      /* the gate / bootError explains why */
    });
  }, [load]);

  useEffect(() => {
    if (!loaded) return;
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        refresh().catch(() => {
          /* keep last good state */
        });
      }
    };
    window.addEventListener('focus', onVis);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onVis);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [loaded, refresh]);
}
