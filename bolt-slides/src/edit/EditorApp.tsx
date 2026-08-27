/* The studio — thumbnail rail + scaled live canvas. Present swaps this
   view in place; published `/` is the audience deck. */
import { useEffect } from 'react';
import { useStore } from '../data/store';
import { isPresenterRoute, isStudioShell } from '../data/shell';
import { applyFont, applyAccent } from '../data/fonts';
import Sidebar from './Sidebar';
import Canvas from './Canvas';
import PresentApp from '../present/PresentApp';

export default function EditorApp() {
  const loaded = useStore((s) => s.loaded);
  const bootError = useStore((s) => s.bootError);
  const presenting = useStore((s) => s.presenting);
  const setPresenting = useStore((s) => s.setPresenting);
  const setCurrent = useStore((s) => s.setCurrent);
  const title = useStore((s) => s.deck.title);
  const font = useStore((s) => s.deck.font);
  const accent = useStore((s) => s.deck.accent);

  useEffect(() => {
    useStore.getState().load();
  }, []);
  useEffect(() => {
    document.title = (title ? title + ' — ' : '') + 'Slides';
  }, [title]);
  useEffect(() => {
    applyFont(font);
  }, [font]);
  useEffect(() => {
    applyAccent(accent);
  }, [accent]);

  if (bootError) return <div className="boot-screen">{bootError}</div>;
  if (!loaded) return <div className="boot-screen">Loading deck…</div>;

  if (isPresenterRoute()) return <PresentApp embedded />;

  if (isStudioShell()) {
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
    return (
      <div className="ed-root">
        <div className="ed-main">
          <Sidebar />
          <Canvas />
        </div>
      </div>
    );
  }

  return <PresentApp embedded />;
}
