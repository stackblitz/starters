/* The editor — persistent slide rail · scaled live canvas with in-place
   editing; the canvas's bottom bar carries the deck actions
   (Export PDF / Play / Share). */
import { useEffect } from 'react';
import { useStore } from '@/data/store';
import { applyFont, applyAccent } from '@/data/fonts';
import Gate from '@/data/Gate';
import { withShare } from '@/data/share';
import Sidebar from './Sidebar';
import Canvas from './Canvas';

export default function EditorApp() {
  const loaded = useStore((s) => s.loaded);
  const denied = useStore((s) => s.denied);
  const mode = useStore((s) => s.mode);
  const load = useStore((s) => s.load);
  const title = useStore((s) => s.deck.title);

  const font = useStore((s) => s.deck.font);
  const accent = useStore((s) => s.deck.accent);
  useEffect(() => {
    load().catch(() => {
      /* the gate explains why */
    });
  }, [load]);
  useEffect(() => {
    document.title = (title ? title + ' — ' : '') + 'Slides';
  }, [title]);
  useEffect(() => {
    applyFont(font);
  }, [font]);
  useEffect(() => {
    applyAccent(accent);
  }, [accent]);
  // a presentation or presenter link opened at / belongs in present mode
  useEffect(() => {
    if (!loaded || mode === 'edit') return;
    window.location.replace(
      withShare(mode === 'presenter' ? '/present?presenter=1' : '/present')
    );
  }, [loaded, mode]);

  if (denied) return <Gate />;
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
