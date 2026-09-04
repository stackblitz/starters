import type { ReactNode } from 'react';
import Reveal from '../deck/Reveal';

export default function Quote({
  text,
  name,
  role,
  img,
  image,
  initials: initialsProp,
  dim,
}: {
  text: ReactNode;
  name?: ReactNode;
  role?: ReactNode;
  img?: string;
  image?: string;
  dim?: number;
  /** avatar initials — required when `name` isn't a plain string */
  initials?: string;
}) {
  const initials =
    initialsProp ??
    (typeof name === 'string'
      ? name
          .split(/\s+/)
          .map((w) => w[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()
      : '');

  return (
    <div className="slide center">
      {image && (
        <>
          <img className="cover-img" src={image} alt="" aria-hidden />
          <div
            className="cover-scrim"
            aria-hidden
            style={dim ? { ['--dim' as string]: dim } : undefined}
          />
        </>
      )}
      <Reveal>
        <div className="quote-mark" aria-hidden>
          “
        </div>
      </Reveal>
      <Reveal delay={0.08}>
        <p
          className="quote-text"
          style={{ marginTop: 'clamp(14px,2.5vh,24px)' }}
        >
          {text}
        </p>
      </Reveal>
      {name && (
        <Reveal delay={0.18}>
          <div className="quote-attr">
            <span className="quote-ava">
              {img ? (
                <img src={img} alt={typeof name === 'string' ? name : ''} />
              ) : (
                initials
              )}
            </span>
            <span className="quote-who">
              <div className="quote-name">{name}</div>
              {role && <div className="quote-role">{role}</div>}
            </span>
          </div>
        </Reveal>
      )}
    </div>
  );
}
