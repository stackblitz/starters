/* The editor — persistent slide rail · scaled live canvas with in-place
   editing; the canvas's bottom bar carries the deck actions
   (Export PDF / Play / Share). */
import { useEffect } from 'react';
import { useStore } from '@/data/store';
import { applyFont, applyAccent } from '@/data/fonts';
import Gate from '@/data/Gate';
import NoDatabase from '@/data/NoDatabase';
import NoKey from '@/data/NoKey';
import { shareToken, withShare } from '@/data/share';
import Sidebar from './Sidebar';
import Canvas from './Canvas';

export default function EditorApp() {
  const loaded = useStore((s) => s.loaded);
  const denied = useStore((s) => s.denied);
  const problem = useStore((s) => s.problem);
  const mode = useStore((s) => s.mode);
  const load = useStore((s) => s.load);
  const watch = useStore((s) => s.watch);
  const title = useStore((s) => s.deck.title);

  const font = useStore((s) => s.deck.font);
  const accent = useStore((s) => s.deck.accent);
  useEffect(() => {
    load().catch(() => {
      /* the gate or the no-database screen explains why */
    });
  }, [load]);
  /* The agent authors slides straight into the database, so the editor watches
     for edits it did not make rather than waiting to be reloaded. */
  useEffect(() => watch(), [watch]);
  useEffect(() => {
    document.title = (title ? title + ' — ' : '') + 'Slides';
  }, [title]);
  useEffect(() => {
    applyFont(font);
  }, [font]);
  useEffect(() => {
    applyAccent(accent);
  }, [accent]);
  /* Not the editor, and no link that says where to go instead: this is the dev
     server's own editor being told it may only present, which means the deck's
     key never reached it. Explain that rather than redirect, or / and /present
     bounce the person between them with nothing to act on. */
  const keyless =
    loaded && mode !== 'edit' && import.meta.env.DEV && !shareToken;

  // a presentation or presenter link opened at / belongs in present mode
  useEffect(() => {
    if (!loaded || mode === 'edit' || keyless) return;
    window.location.replace(
      withShare(mode === 'presenter' ? '/present?presenter=1' : '/present')
    );
  }, [loaded, mode, keyless]);

  if (problem) return <NoDatabase />;
  if (denied) return <Gate />;
  if (keyless) return <NoKey />;
  if (!loaded) return <div className="boot-screen">Loading deck…</div>;

  return (
    <div className="ed-root">
      <div className="ed-main">
        <Sidebar />
        <Canvas />
      </div>
    </div>
  );
}
