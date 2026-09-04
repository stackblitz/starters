import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { renderRich } from './rich';
import { parseNotes, HL_ONE, HEX, splitNoteHl } from './notesFormat';

function inlineCode(text: string): ReactNode {
  return text.split(/(`[^`]+`)/g).map((seg, i) =>
    seg.startsWith('`') && seg.endsWith('`') && seg.length > 2 ? (
      <code className="note-code" key={i}>
        {seg.slice(1, -1)}
      </code>
    ) : (
      <Fragment key={i}>{renderRich(seg)}</Fragment>
    )
  );
}
function inline(text: string): ReactNode {
  return splitNoteHl(text).map((seg, i) => {
    const m = HL_ONE.exec(seg);
    if (m && HEX.test(m[1]))
      return (
        <mark className="note-hl" key={i} style={{ background: m[1] }}>
          {inlineCode(m[2])}
        </mark>
      );
    return <Fragment key={i}>{inlineCode(seg)}</Fragment>;
  });
}

export function NotesView({ text }: { text: string }) {
  const blocks = parseNotes(text);
  if (!blocks.length) return null;
  return (
    <>
      {blocks.map((b, i) => {
        if (b.kind === 'h')
          return (
            <h3 className="note-h" key={i}>
              {inline(b.lines[0])}
            </h3>
          );
        if (b.kind === 'quote')
          return (
            <blockquote className="note-quote" key={i}>
              {b.lines.map((l, j) => (
                <p key={j}>{inline(l)}</p>
              ))}
            </blockquote>
          );
        if (b.kind === 'ul')
          return (
            <ul className="note-list" key={i}>
              {b.items.map((it, j) => (
                <li key={j}>{inline(it)}</li>
              ))}
            </ul>
          );
        if (b.kind === 'ol')
          return (
            <ol className="note-list" key={i}>
              {b.items.map((it, j) => (
                <li key={j}>{inline(it)}</li>
              ))}
            </ol>
          );
        return (
          <p className="note-p" key={i}>
            {b.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}
