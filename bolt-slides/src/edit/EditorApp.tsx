/* The editor — persistent slide rail · scaled live canvas with in-place
   editing; the canvas's bottom bar carries the deck actions
   (Export PDF / Play / Share). */
import { useEffect } from 'react';
import { useStore } from '../data/store';
import { useDeckSync } from '../data/useDeckSync';
import { applyFont, applyAccent } from '../data/fonts';
import Gate from '../data/Gate';
import { withShare } from '../data/share';
import Sidebar from './Sidebar';
import Canvas from './Canvas';
import PresentApp from '../present/PresentApp';

export default function EditorApp() {
  const loaded = useStore((s) => s.loaded);
  const denied = useStore((s) => s.denied);
  const bootError = useStore((s) => s.bootError);
  const mode = useStore((s) => s.mode);
  const presenting = useStore((s) => s.presenting);
  const setPresenting = useStore((s) => s.setPresenting);
  const setCurrent = useStore((s) => s.setCurrent);
  const title = useStore((s) => s.deck.title);

  const font = useStore((s) => s.deck.font);
  const accent = useStore((s) => s.deck.accent);
  const presenterQuery = new URLSearchParams(window.location.search).has(
    'presenter'
  );
  useDeckSync();
  useEffect(() => {
    document.title = (title ? title + ' — ' : '') + 'Slides';
  }, [title]);
  useEffect(() => {
    applyFont(font);
  }, [font]);
  useEffect(() => {
    applyAccent(accent);
  }, [accent]);
  // a presenter share opened at / belongs on the console URL. Audience
  // present stays on `/` so published origin and cover capture need no
  // extra hop.
  useEffect(() => {
    if (!loaded || mode !== 'presenter' || presenterQuery) return;
    window.location.replace(withShare('/present?presenter=1'));
  }, [loaded, mode, presenterQuery]);

  if (denied) return <Gate />;
  if (bootError) return <div className="boot-screen">{bootError}</div>;
  if (!loaded) return <div className="boot-screen">Loading deck…</div>;
  // A P popup is a real presenter console: no onExit (Esc must close, not
  // become the editor) and no initialSlide from this tab's current (fresh
  // store is slide 0 — the hash is the source of truth).
  if (presenterQuery && mode !== 'present') return <PresentApp embedded />;
  // Present from the editor is in-place (no /present).
  if (presenting)
    return (
      <PresentApp
        embedded
        onExit={(i) => {
          setCurrent(i);
          setPresenting(false);
        }}
      />
    );
  if (mode === 'present') return <PresentApp embedded />;

  return (
    <div className="ed-root">
      <div className="ed-main">
        <Sidebar />
        <Canvas />
      </div>
    </div>
  );
}
