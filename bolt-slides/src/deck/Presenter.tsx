import { useEffect, useState } from 'react';
import type { SlideData } from '../data/types';
import SlideView from '../slide/SlideView';
import Thumb from './Thumb';
import type { DeckCtxValue } from './DeckContext';
import { NotesView } from '../edit/notes';
import { IconLeft, IconRight, IconClose } from './icons';

function renderSlide(slide: SlideData) {
  return (
    <SlideView
      slide={slide}
      notes={slide.notes}
      transition={slide.transition ?? undefined}
    />
  );
}

/* The presenter console (/present?presenter=1) — a second-screen cockpit, not
   a copy of the slide: what the audience sees right now (live, mid-build),
   what is coming next, the speaker notes at reading size, a stopwatch, the
   wall clock and the deck's progress.

   Notes are authored in the studio (and in deck.json) and shown here
   at reading size — not editable in this console. */

const pad = (value: number) => String(value).padStart(2, '0');
const fmtClock = (totalSeconds: number) =>
  (totalSeconds >= 3600 ? `${pad(Math.floor(totalSeconds / 3600))}:` : '') +
  `${pad(Math.floor(totalSeconds / 60) % 60)}:${pad(totalSeconds % 60)}`;

const IconPlay = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M7 4.7v14.6c0 .8.9 1.3 1.6.9l11-7.3a1 1 0 0 0 0-1.7l-11-7.3c-.7-.5-1.6 0-1.6.8Z" />
  </svg>
);
const IconPause = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M7 4h3.4v16H7zM13.6 4H17v16h-3.4z" />
  </svg>
);
const IconReset = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M9 8L5 12l4 4M5 12h9a4 4 0 1 1 0 8h-3" />
  </svg>
);
const IconType = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M4 7V5h16v2M12 5v14M9 19h6" />
  </svg>
);

/* ── the console ───────────────────────────────────────────────────── */
const NOTE_SIZES = [15, 17, 19, 22, 25];
const SIZE_KEY = 'deck:presenter-note-size';

export default function Presenter({
  slides,
  slideIndex,
  slideCount,
  clicks,
  buildMax,
  liveCtx,
  notes,
  onGo,
  onNext,
  onPrev,
  navLabel,
  onExit,
}: {
  slides: SlideData[];
  slideIndex: number;
  slideCount: number;
  clicks: number;
  buildMax: number;
  liveCtx: DeckCtxValue;
  notes: string;
  onGo: (index: number) => void;
  onNext: () => void;
  onPrev: () => void;
  navLabel?: (index: number) => string | undefined;
  /** leave the console for the editor when this is not a script-opened window */
  onExit?: (slideIndex: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [sizeIdx, setSizeIdx] = useState(() => {
    const stored = parseInt(localStorage.getItem(SIZE_KEY) || '', 10);
    return Number.isFinite(stored) && stored >= 0 && stored < NOTE_SIZES.length
      ? stored
      : 2;
  });

  useEffect(() => {
    localStorage.setItem(SIZE_KEY, String(sizeIdx));
  }, [sizeIdx]);
  useEffect(() => {
    const tick = setInterval(() => {
      setNow(new Date());
      if (running) setElapsed((seconds) => seconds + 1);
    }, 1000);
    return () => clearInterval(tick);
  }, [running]);

  // T runs/pauses the clock, ⇧T resets it, +/− size the notes. Slide keys stay
  // with the deck, so → still advances the audience window.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'TEXTAREA' ||
          target.tagName === 'INPUT' ||
          target.isContentEditable)
      )
        return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 't') {
        event.preventDefault();
        setRunning((runningNow) => !runningNow);
      } else if (event.key === 'T') {
        event.preventDefault();
        setElapsed(0);
        setRunning(true);
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        setSizeIdx((idx) => Math.min(NOTE_SIZES.length - 1, idx + 1));
      } else if (event.key === '-') {
        event.preventDefault();
        setSizeIdx((idx) => Math.max(0, idx - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const currentSlide = slides[slideIndex];
  const nextSlide = slides[slideIndex + 1];
  const nextName = navLabel?.(slideIndex + 1);
  const progress = slideCount > 1 ? (slideIndex / (slideCount - 1)) * 100 : 100;
  const builds =
    buildMax > 0
      ? `Build ${Math.min(clicks, buildMax) + 1} / ${buildMax + 1}`
      : null;

  return (
    <div className="pres">
      <header className="pres-top">
        <div className="pres-timer">
          <span className={'pres-time' + (running ? '' : ' paused')}>
            {fmtClock(elapsed)}
          </span>
          <button
            className="pres-icon"
            onClick={() => setRunning((runningNow) => !runningNow)}
            data-tip={running ? 'Pause (T)' : 'Start (T)'}
            aria-label={running ? 'Pause timer' : 'Start timer'}
          >
            {running ? <IconPause /> : <IconPlay />}
          </button>
          <button
            className="pres-icon"
            onClick={() => {
              setElapsed(0);
              setRunning(true);
            }}
            data-tip="Reset (⇧T)"
            aria-label="Reset timer"
          >
            <IconReset />
          </button>
        </div>

        <div className="pres-center">
          <span className="pres-count">
            <b>{slideIndex + 1}</b> / {slideCount}
          </span>
          {builds && <span className="pres-builds">{builds}</span>}
        </div>

        <div className="pres-right">
          <span className="pres-clock">
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="pres-sep" />
          <button
            className="pres-icon"
            onClick={() => setSizeIdx((idx) => Math.max(0, idx - 1))}
            disabled={sizeIdx === 0}
            data-tip={sizeIdx === 0 ? undefined : 'Smaller notes (−)'}
            aria-label="Smaller notes"
          >
            <IconType />
            <span className="pres-icon-sub">−</span>
          </button>
          <button
            className="pres-icon"
            onClick={() =>
              setSizeIdx((idx) => Math.min(NOTE_SIZES.length - 1, idx + 1))
            }
            disabled={sizeIdx === NOTE_SIZES.length - 1}
            data-tip={
              sizeIdx === NOTE_SIZES.length - 1 ? undefined : 'Bigger notes (+)'
            }
            aria-label="Bigger notes"
          >
            <IconType />
            <span className="pres-icon-sub">+</span>
          </button>
          {(onExit || window.opener) && (
            <button
              className="pres-icon"
              onClick={() => {
                if (window.opener) {
                  window.close();
                  return;
                }
                onExit?.(slideIndex);
              }}
              data-tip={window.opener ? 'Close presenter' : 'Back to editor'}
              aria-label={
                window.opener ? 'Close presenter view' : 'Back to the editor'
              }
            >
              <IconClose />
            </button>
          )}
        </div>
      </header>

      <div className="pres-body">
        <section className="pres-stage">
          <div className="pres-label">On screen now</div>
          <div className="pres-now">
            {currentSlide ? (
              <Thumb ctx={liveCtx}>{renderSlide(currentSlide)}</Thumb>
            ) : null}
          </div>

          <div className="pres-next-wrap">
            <div className="pres-label">
              Up next
              {nextName ? (
                <span className="pres-next-name"> · {nextName}</span>
              ) : null}
            </div>
            {nextSlide ? (
              <button
                className="pres-next"
                onClick={() => onGo(slideIndex + 1)}
                aria-label="Go to next slide"
              >
                <Thumb>{renderSlide(nextSlide)}</Thumb>
              </button>
            ) : (
              <div className="pres-next pres-next-end">End of deck</div>
            )}
          </div>
        </section>

        <section className="pres-notes-col">
          <div className="pres-label pres-notes-head">Speaker notes</div>
          <div className="pres-notes-box">
            <div
              className="pres-notes"
              style={{ fontSize: NOTE_SIZES[sizeIdx] }}
            >
              {notes.trim() ? (
                <NotesView text={notes} />
              ) : (
                <p className="pres-notes-empty">No notes for this slide.</p>
              )}
            </div>
          </div>
        </section>
      </div>

      <footer className="pres-bottom">
        <button
          className="pres-nav"
          onClick={onPrev}
          disabled={slideIndex === 0 && clicks === 0}
          aria-label="Previous"
        >
          <IconLeft /> Prev
        </button>
        <div className="pres-progress" role="presentation">
          <div
            className="pres-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <button
          className="pres-nav"
          onClick={onNext}
          disabled={slideIndex >= slideCount - 1 && clicks >= buildMax}
          aria-label="Next"
        >
          Next <IconRight />
        </button>
      </footer>
    </div>
  );
}
