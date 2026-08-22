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
  // a presentation or presenter link opened at / belongs in present mode
  useEffect(() => {
    if (!loaded || mode === 'edit') return;
    window.location.replace(
      withShare(mode === 'presenter' ? '/present?presenter=1' : '/present')
    );
  }, [loaded, mode]);

  if (denied) return <Gate />;
  if (bootError) return <div className="boot-screen">{bootError}</div>;
  if (!loaded) return <div className="boot-screen">Loading deck…</div>;
  // Present from the editor is in-place (no /present). A presenter console
  // opened with P still uses ?presenter=1 on this same path.
  const presenterQuery = new URLSearchParams(window.location.search).has(
    'presenter'
  );
  if (presenting || presenterQuery)
    return (
      <PresentApp
        embedded
        onExit={
          presenterQuery
            ? undefined
            : (i) => {
                setCurrent(i);
                setPresenting(false);
              }
        }
      />
    );

  return (
    <div className="ed-root">
      <div className="ed-main">
        <Sidebar />
        <Canvas />
      </div>
    </div>
  );
}
