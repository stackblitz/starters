import type { ReactNode } from 'react';
import Reveal from '../deck/Reveal';

export default function Section({
  n,
  kicker,
  title,
  image,
  dim,
}: {
  n?: number | string;
  kicker?: string;
  title: ReactNode;
  image?: string;
  dim?: number;
}) {
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
      <div className="sec-glow" aria-hidden />
      {n != null && (
        <div className="sec-ghost" aria-hidden>
          {String(n).padStart(2, '0')}
        </div>
      )}
      <Reveal>
        {kicker && (
          <div className="kicker" style={{ marginBottom: 16 }}>
            {kicker}
          </div>
        )}
        <h2 className="display">{title}</h2>
      </Reveal>
    </div>
  );
}
