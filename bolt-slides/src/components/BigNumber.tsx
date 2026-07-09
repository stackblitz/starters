import type { ReactNode } from 'react';
import Reveal from '../deck/Reveal';

/* The giant-figure drama slide — one enormous accent number, a caption, and
   an optional source line. Pass a <CountUp> as the value so it animates in.
   <BigNumber kicker="The market" value={<CountUp to={3} prefix="$" suffix="T" />}
     caption="moves through supply chains every year" foot="Source: McKinsey, 2025" /> */
export default function BigNumber({
  kicker,
  value,
  caption,
  foot,
}: {
  kicker?: string;
  value: ReactNode;
  caption?: ReactNode;
  foot?: string;
  nav?: string;
  notes?: string;
}) {
  return (
    <div className="slide center">
      <Reveal>
        {kicker && (
          <div className="kicker" style={{ marginBottom: 18 }}>
            {kicker}
          </div>
        )}
      </Reveal>
      <Reveal delay={0.08}>
        <div className="figure">{value}</div>
      </Reveal>
      {caption && (
        <Reveal delay={0.18}>
          <p className="subhead bignum-caption">{caption}</p>
        </Reveal>
      )}
      {foot && (
        <Reveal delay={0.3}>
          <div className="foot" style={{ marginTop: 'clamp(16px,3vh,26px)' }}>
            {foot}
          </div>
        </Reveal>
      )}
    </div>
  );
}
