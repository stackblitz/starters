import { Fragment } from 'react';

/* A continuously-scrolling strip — logo wall, value props, tech stack.
   Items are separated by small accent diamonds; hovering pauses the strip. */
export default function Marquee({
  items,
  duration = 26,
}: {
  items: string[];
  duration?: number;
}) {
  const run = (copy: number) => (
    <Fragment key={copy}>
      {items.map((it, i) => (
        <Fragment key={`${copy}-${i}`}>
          <span className="marquee-item" aria-hidden={copy === 1 || undefined}>
            {it}
          </span>
          <span className="marquee-dot" aria-hidden />
        </Fragment>
      ))}
    </Fragment>
  );
  return (
    <div className="marquee">
      <div
        className="marquee-track"
        style={{ animationDuration: `${duration}s` }}
      >
        {run(0)}
        {run(1)}
      </div>
    </div>
  );
}
