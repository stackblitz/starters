import type { ReactNode } from 'react';
import Reveal from '../deck/Reveal';

/* The standardized opening slide: kicker → display title → subtitle cascade,
   an optional full-bleed background image under a theme-correct scrim, and an
   optional foot line (date · presenter · confidential).
   <Cover kicker="Acme · Series A" title={<><span className="accent-text">Acme</span></>}
     subtitle="Answers, not dashboards." image="/cover.webp" foot="June 2026 · Dana Kim" /> */
export default function Cover({
  kicker,
  title,
  subtitle,
  image,
  foot,
}: {
  kicker?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  image?: string;
  foot?: string;
  nav?: string;
  notes?: string;
}) {
  return (
    <div className="slide center">
      {image && (
        <>
          <img className="cover-img" src={image} alt="" aria-hidden />
          <div className="cover-scrim" aria-hidden />
        </>
      )}
      <Reveal>
        {kicker && (
          <div className="kicker" style={{ marginBottom: 14 }}>
            {kicker}
          </div>
        )}
      </Reveal>
      <Reveal delay={0.08}>
        <h1 className="display">{title}</h1>
      </Reveal>
      {subtitle && (
        <Reveal delay={0.16}>
          <p className="subhead" style={{ marginTop: 18 }}>
            {subtitle}
          </p>
        </Reveal>
      )}
      {foot && (
        <Reveal delay={0.3} className="cover-foot">
          <div className="foot">{foot}</div>
        </Reveal>
      )}
    </div>
  );
}
