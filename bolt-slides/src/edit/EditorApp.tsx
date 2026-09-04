import { useCallback, useEffect, useState } from 'react';
import { LayoutGroup, MotionConfig } from 'motion/react';
import { useStore } from '../data/store';
import {
  allowPresenterFeatures,
  isPresentRoute,
  isPresenterRoute,
  isStudioShell,
} from '../data/shell';
import { applyFont, applyAccent } from '../data/fonts';
import Canvas from './Canvas';
import PresentApp from '../present/PresentApp';
import SlideBrowser, { type BrowseMode } from '../deck/SlideBrowser';

export default function EditorApp() {
  const loaded = useStore((state) => state.loaded);
  const bootError = useStore((state) => state.bootError);
  const slides = useStore((state) => state.slides);
  const current = useStore((state) => state.current);
  const setCurrent = useStore((state) => state.setCurrent);
  const title = useStore((state) => state.deck.title);
  const font = useStore((state) => state.deck.font);
  const accent = useStore((state) => state.deck.accent);
  const [browse, setBrowse] = useState<BrowseMode>('rail');
  const [gridFocus, setGridFocus] = useState(0);

  const toggleRail = useCallback(
    () => setBrowse((mode) => (mode === 'rail' ? 'none' : 'rail')),
    []
  );

  const toggleGrid = useCallback(
    () => setBrowse((mode) => (mode === 'grid' ? 'none' : 'grid')),
    []
  );

  const closeBrowse = useCallback(() => setBrowse('none'), []);

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

  if (isPresenterRoute() && allowPresenterFeatures())
    return <PresentApp embedded />;

  if (isPresentRoute() && isStudioShell()) return <PresentApp embedded />;

  if (isStudioShell()) {
    return (
      <MotionConfig reducedMotion="user">
        <LayoutGroup id="slides-stage">
          <div className="ed-root">
            <div className="ed-main">
              <Canvas
                browse={browse}
                gridFocus={gridFocus}
                onToggleRail={toggleRail}
                onToggleGrid={toggleGrid}
                onCloseBrowse={closeBrowse}
              />
            </div>
            <SlideBrowser
              slides={slides}
              current={current}
              browse={browse}
              mutable
              canDelete
              onGo={setCurrent}
              onClose={closeBrowse}
              onGridFocusChange={setGridFocus}
            />
          </div>
        </LayoutGroup>
      </MotionConfig>
    );
  }

  return <PresentApp embedded allowPresenter={false} />;
}
