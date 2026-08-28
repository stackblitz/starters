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
  const loaded = useStore((state) => state.loaded);
  const bootError = useStore((state) => state.bootError);
  const presenting = useStore((state) => state.presenting);
  const setPresenting = useStore((state) => state.setPresenting);
  const setCurrent = useStore((state) => state.setCurrent);
  const title = useStore((state) => state.deck.title);
  const font = useStore((state) => state.deck.font);
  const accent = useStore((state) => state.deck.accent);

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
