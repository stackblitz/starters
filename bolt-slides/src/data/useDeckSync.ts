import { useEffect } from 'react';
import { useStore } from './store';
import { subscribeDeckChanges } from './realtime';
import { bootOwnerProof, hasOwnerProof, OWNER_PROOF_EVENT } from './owner';

/** Load once, then re-fetch as soon as deck-api broadcasts a write (other
 *  windows). Focus/visibility is the fallback for agent SQL writes, which
 *  do not emit that ping. */
export function useDeckSync({ enabled = true }: { enabled?: boolean } = {}) {
  const load = useStore((s) => s.load);
  const refresh = useStore((s) => s.refresh);
  const loaded = useStore((s) => s.loaded);

  useEffect(() => {
    if (!enabled) return;
    const ac = new AbortController();
    void bootOwnerProof(ac.signal)
      .then(() => {
        if (ac.signal.aborted) return;
        return load();
      })
      .catch(() => {
        /* the gate / bootError explains why */
      });
    return () => ac.abort();
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return;
    const onProof = () => {
      if (!hasOwnerProof()) return;
      const s = useStore.getState();
      if (s.mode === 'edit' && s.loaded && !s.denied) return;
      useStore.setState({ denied: null });
      load().catch(() => {
        /* still gated */
      });
    };
    window.addEventListener(OWNER_PROOF_EVENT, onProof);
    return () => window.removeEventListener(OWNER_PROOF_EVENT, onProof);
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
