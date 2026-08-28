/* Side-effect hooks extracted from Deck — keyboard, hash, broadcast sync,
   fullscreen, and idle cursor / dock proximity. Behavior matches the prior
   inline effects; Deck owns the state these hooks write. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/** True once a scroll container has moved off the top. */
export function useScrolled(
  ref: RefObject<HTMLElement | null>,
  active: boolean
) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) {
      setScrolled(false);
      return;
    }
    const onScroll = () => setScrolled(el.scrollTop > 0);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [ref, active]);
  return scrolled;
}

export function useDeckKeyboard(options: {
  next: () => void;
  prev: () => void;
  go: (index: number) => void;
  slideCount: number;
  slideIndex: number;
  toggleFullscreen: () => void;
  openPresenter: () => void;
  toggleRail: () => void;
  toggleGrid: () => void;
  closeBrowse: () => void;
  drawing: boolean;
  browse: 'none' | 'rail' | 'grid';
  uiHidden: boolean;
  isPresenter: boolean;
  canOpenPresenter: boolean;
  onExit?: (slideIndex: number) => void;
  setDrawing: (value: boolean | ((open: boolean) => boolean)) => void;
  setUiHidden: (value: boolean | ((hidden: boolean) => boolean)) => void;
}) {
  const {
    next,
    prev,
    go,
    slideCount,
    slideIndex,
    toggleFullscreen,
    openPresenter,
    toggleRail,
    toggleGrid,
    closeBrowse,
    drawing,
    browse,
    uiHidden,
    isPresenter,
    canOpenPresenter,
    onExit,
    setDrawing,
    setUiHidden,
  } = options;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'TEXTAREA' ||
          target.tagName === 'INPUT' ||
          target.isContentEditable)
      )
        return;
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
        case 'PageDown':
          event.preventDefault();
          next();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          event.preventDefault();
          prev();
          break;
        case 'Home':
          event.preventDefault();
          go(0);
          break;
        case 'End':
          event.preventDefault();
          go(slideCount - 1);
          break;
        // while drawing, the annotator owns letter keys it uses (O, P, H) —
        // D and Escape still exit
        case 'o':
        case 'O':
          if (isPresenter || drawing) break;
          toggleRail();
          break;
        case 's':
        case 'S':
          if (isPresenter) break;
          toggleRail();
          break;
        case 'g':
        case 'G':
          if (isPresenter) break;
          toggleGrid();
          break;
        case 'f':
        case 'F':
          if (isPresenter) break;
          toggleFullscreen();
          break;
        case 'd':
        case 'D':
          if (isPresenter) break;
          setDrawing((open) => !open);
          break;
        case 'p':
        case 'P':
          if (drawing || !canOpenPresenter) break;
          openPresenter();
          break;
        case 'h':
        case 'H':
          if (isPresenter || drawing) break;
          setUiHidden((hidden) => !hidden);
          break;
        case 'Escape':
          if (isPresenter) {
            event.preventDefault();
            if (window.opener) window.close();
            break;
          }
          if (browse !== 'none' || drawing || uiHidden) {
            closeBrowse();
            setDrawing(false);
            setUiHidden(false);
            break;
          }
          if (onExit) {
            event.preventDefault();
            onExit(slideIndex);
          }
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    next,
    prev,
    go,
    slideCount,
    toggleFullscreen,
    openPresenter,
    toggleRail,
    toggleGrid,
    closeBrowse,
    drawing,
    browse,
    uiHidden,
    isPresenter,
    canOpenPresenter,
    onExit,
    slideIndex,
    setDrawing,
    setUiHidden,
  ]);
}

/** Sync slide index ↔ URL hash. Skipped for in-place studio Present. */
export function useDeckHashSync(options: {
  slideIndex: number;
  slideCount: number;
  go: (index: number) => void;
  skipHash: boolean;
}) {
  const { slideIndex, slideCount, go, skipHash } = options;

  useEffect(() => {
    if (skipHash) return;
    const want = String(slideIndex + 1);
    if (window.location.hash.slice(1) !== want)
      history.replaceState(null, '', '#' + want);
  }, [slideIndex, skipHash]);

  useEffect(() => {
    if (skipHash) return;
    const onHash = () => {
      const hashSlide = parseInt(window.location.hash.slice(1), 10);
      if (
        hashSlide >= 1 &&
        hashSlide <= slideCount &&
        hashSlide - 1 !== slideIndex
      )
        go(hashSlide - 1);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [slideIndex, slideCount, go, skipHash]);
}

/** Cross-tab audience ⇄ presenter sync. Leaders publish; others subscribe. */
export function useDeckBroadcastSync(options: {
  slideIndex: number;
  clicks: number;
  isLeader: boolean;
  setSlideIndex: (index: number) => void;
  setClicks: (clicks: number) => void;
}) {
  const { slideIndex, clicks, isLeader, setSlideIndex, setClicks } = options;
  const syncChannel = useRef<BroadcastChannel | null>(null);
  const applyingRemote = useRef(false);

  useEffect(() => {
    const channel = new BroadcastChannel('deck-sync');
    syncChannel.current = channel;
    channel.onmessage = (event) => {
      if (event.data?.type !== 'state') return;
      /* wire format keeps `slide` so an older presenter tab still syncs */
      const remoteSlide = event.data.slide;
      const remoteClicks = event.data.clicks;
      if (
        !Number.isInteger(remoteSlide) ||
        !Number.isInteger(remoteClicks) ||
        remoteSlide < 0 ||
        remoteClicks < 0
      )
        return;
      applyingRemote.current = true;
      setSlideIndex(remoteSlide);
      setClicks(remoteClicks);
    };
    return () => channel.close();
  }, [setSlideIndex, setClicks]);

  useEffect(() => {
    if (!isLeader) return;
    if (applyingRemote.current) {
      applyingRemote.current = false;
      return;
    }
    syncChannel.current?.postMessage({
      type: 'state',
      slide: slideIndex,
      clicks,
    });
  }, [slideIndex, clicks, isLeader]);
}

export function useFullscreenState() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () =>
      setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }, []);

  return { isFullscreen, toggleFullscreen };
}

/** Cursor idle + pointer near the dock (uses dock bounds when mounted). */
export function useIdleCursorNearDock(dockRef?: RefObject<HTMLElement | null>) {
  const [nearDock, setNearDock] = useState(false);
  const [cursorIdle, setCursorIdle] = useState(false);

  useEffect(() => {
    let idleTimer = 0;
    const onMove = (event: MouseEvent) => {
      setCursorIdle(false);
      const el = dockRef?.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const pad = 80;
        setNearDock(
          event.clientX >= rect.left - pad &&
            event.clientX <= rect.right + pad &&
            event.clientY >= rect.top - pad &&
            event.clientY <= rect.bottom + pad
        );
      } else {
        setNearDock(event.clientY > window.innerHeight - 150);
      }
      clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => setCursorIdle(true), 2600);
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      clearTimeout(idleTimer);
      window.removeEventListener('mousemove', onMove);
    };
  }, [dockRef]);

  return { nearDock, cursorIdle };
}

/** Hold annotations until the incoming slide finishes its entrance. */
export function useStageEntrance(slideIndex: number) {
  const [stageIn, setStageIn] = useState(false);

  useEffect(() => {
    setStageIn(false);
    const safetyTimer = window.setTimeout(() => setStageIn(true), 1000);
    return () => clearTimeout(safetyTimer);
  }, [slideIndex]);

  return { stageIn, setStageIn };
}
