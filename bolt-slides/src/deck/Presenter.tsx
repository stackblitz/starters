import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import Thumb from './Thumb';
import type { DeckCtxValue } from './DeckContext';
import { NotesView } from '../edit/notes';
import { IconLeft, IconRight, IconClose } from './icons';

/* The presenter console (/present?presenter=1) — a second-screen cockpit, not
   a copy of the slide: what the audience sees right now (live, mid-build),
   what is coming next, the speaker notes at reading size, a stopwatch, the
   wall clock and the deck's progress.

   Notes are authored in the studio (and in deck.json) and shown here
   at reading size — not editable in this console. */

const pad = (n: number) => String(n).padStart(2, '0');
const fmtClock = (s: number) =>
  (s >= 3600 ? `${pad(Math.floor(s / 3600))}:` : '') +
  `${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;

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
  slide,
  total,
  clicks,
  curMax,
  liveCtx,
  notes,
  onGo,
  onNext,
  onPrev,
  navLabel,
  onExit,
}: {
  slides: ReactElement[];
  slide: number;
  total: number;
  clicks: number;
  curMax: number;
  liveCtx: DeckCtxValue;
  notes: string;
  onGo: (i: number) => void;
  onNext: () => void;
  onPrev: () => void;
  navLabel?: (i: number) => string | undefined;
  /** leave the console for the editor when this is not a script-opened window */
  onExit?: (slideIndex: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [sizeIdx, setSizeIdx] = useState(() => {
    const v = parseInt(localStorage.getItem(SIZE_KEY) || '', 10);
    return Number.isFinite(v) && v >= 0 && v < NOTE_SIZES.length ? v : 2;
  });

  useEffect(() => {
    localStorage.setItem(SIZE_KEY, String(sizeIdx));
  }, [sizeIdx]);
  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
      if (running) setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [running]);

  // T runs/pauses the clock, ⇧T resets it, +/− size the notes. Slide keys stay
  // with the deck, so → still advances the audience window.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === 'TEXTAREA' ||
          el.tagName === 'INPUT' ||
          el.isContentEditable)
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 't') {
        e.preventDefault();
        setRunning((v) => !v);
      } else if (e.key === 'T') {
        e.preventDefault();
        setElapsed(0);
        setRunning(true);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setSizeIdx((i) => Math.min(NOTE_SIZES.length - 1, i + 1));
      } else if (e.key === '-') {
        e.preventDefault();
        setSizeIdx((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const nextEl = slides[slide + 1];
  const nextName = navLabel?.(slide + 1);
  const progress = total > 1 ? (slide / (total - 1)) * 100 : 100;
  const builds =
    curMax > 0 ? `Build ${Math.min(clicks, curMax) + 1} / ${curMax + 1}` : null;

  return (
    <div className="pres">
      <header className="pres-top">
        <div className="pres-timer">
          <span className={'pres-time' + (running ? '' : ' paused')}>
            {fmtClock(elapsed)}
          </span>
          <button
            className="pres-icon"
            onClick={() => setRunning((v) => !v)}
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
            <b>{slide + 1}</b> / {total}
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
            onClick={() => setSizeIdx((i) => Math.max(0, i - 1))}
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
              setSizeIdx((i) => Math.min(NOTE_SIZES.length - 1, i + 1))
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
                onExit?.(slide);
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
            <Thumb ctx={liveCtx}>{slides[slide]}</Thumb>
          </div>

          <div className="pres-next-wrap">
            <div className="pres-label">
              Up next
              {nextName ? (
                <span className="pres-next-name"> · {nextName}</span>
              ) : null}
            </div>
            {nextEl ? (
              <button
                className="pres-next"
                onClick={() => onGo(slide + 1)}
                aria-label="Go to next slide"
              >
                <Thumb>{nextEl}</Thumb>
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
          disabled={slide === 0 && clicks === 0}
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
          disabled={slide >= total - 1 && clicks >= curMax}
          aria-label="Next"
        >
          Next <IconRight />
        </button>
      </footer>
    </div>
  );
}
