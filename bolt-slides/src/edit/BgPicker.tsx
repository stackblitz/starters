/* BgPicker — reusable background control: none / color / gradient (+ image
   where allowed). Drives the slide background in the Design tab and per-card
   backgrounds inside layout fields. */
import type { Background } from '@/data/types';

export const GRADIENTS: { from: string; to: string }[] = [
  { from: '#0a0f1e', to: '#12325e' },
  { from: '#0b1026', to: '#3b2f8f' },
  { from: '#04121f', to: '#0e4f63' },
  { from: '#101426', to: '#37175e' },
  { from: '#071a17', to: '#0e5246' },
  { from: '#10131a', to: '#3a4356' },
  { from: '#1d1030', to: '#7b2c5e' },
  { from: '#23100d', to: '#8f3a1e' },
  { from: '#1e1405', to: '#8a5a13' },
  { from: '#230d18', to: '#6e1e3c' },
  { from: '#050505', to: '#2b2b31' },
  { from: '#0d1b3d', to: '#1688fc' },
];

/* Dim: a real track that fills as it darkens, with the value shown. The old
   row squeezed a native slider between a flex-1 label and the panel edge, so
   it barely moved and read as broken. Shared by slide backgrounds and by the
   layouts that carry their own full-bleed image. */
export function DimSlider({
  value,
  onChange,
  label = 'Dim',
  hint,
}: {
  value: number;
  onChange: (v: number) => void;
  label?: string;
  hint?: string;
}) {
  const pct = Math.round(value * 100);
  const id = `dim-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="fld dim-fld">
      <div className="dim-head">
        <label htmlFor={id}>{label}</label>
        <span className="dim-value">{pct}%</span>
      </div>
      <input
        id={id}
        className="dim-range"
        type="range"
        min={0}
        max={0.85}
        step={0.05}
        value={value}
        aria-label="Darken the image"
        aria-valuetext={`${pct} percent`}
        style={{ ['--fill' as string]: `${(value / 0.85) * 100}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <p className="fld-hint">{hint}</p>}
    </div>
  );
}

export default function BgPicker({
  value,
  onChange,
  image = false,
  noneLabel = 'none',
}: {
  value: Background | undefined;
  onChange: (b: Background) => void;
  /** allow the image mode (slide backgrounds yes, cards no) */
  image?: boolean;
  noneLabel?: string;
}) {
  const bg = value ?? { type: 'none' };
  const modes = (
    image
      ? ['none', 'color', 'gradient', 'image']
      : ['none', 'color', 'gradient']
  ) as ('none' | 'color' | 'gradient' | 'image')[];
  return (
    <div className="bg-editor">
      <div className="seg">
        {modes.map((t) => (
          <button
            key={t}
            className={'seg-btn' + (bg.type === t ? ' on' : '')}
            onClick={() => {
              if (t === 'none') onChange({ type: 'none' });
              if (t === 'color')
                onChange({
                  type: 'color',
                  color: bg.type === 'color' ? bg.color : '#101623',
                });
              if (t === 'gradient')
                onChange({
                  type: 'gradient',
                  from: '#0b1026',
                  to: '#12325e',
                  angle: 135,
                });
              if (t === 'image')
                onChange({ type: 'image', url: '', dim: 0.45 });
            }}
          >
            {t === 'none' ? noneLabel : t}
          </button>
        ))}
      </div>

      {bg.type === 'color' && (
        <div className="fld row">
          <input
            type="color"
            value={bg.color}
            onChange={(e) => onChange({ type: 'color', color: e.target.value })}
          />
          <input
            value={bg.color}
            onChange={(e) => onChange({ type: 'color', color: e.target.value })}
          />
        </div>
      )}

      {bg.type === 'gradient' && (
        <>
          <div className="fld row">
            <input
              type="color"
              value={bg.from}
              onChange={(e) => onChange({ ...bg, from: e.target.value })}
            />
            <input
              type="color"
              value={bg.to}
              onChange={(e) => onChange({ ...bg, to: e.target.value })}
            />
            <input
              type="number"
              className="angle"
              value={bg.angle ?? 135}
              title="Angle"
              onChange={(e) =>
                onChange({ ...bg, angle: Number(e.target.value) })
              }
            />
          </div>
          <div className="swatches">
            {GRADIENTS.map((g, i) => (
              <button
                key={i}
                className="swatch"
                style={{
                  background: `linear-gradient(135deg, ${g.from}, ${g.to})`,
                }}
                onClick={() =>
                  onChange({ type: 'gradient', ...g, angle: bg.angle ?? 135 })
                }
              />
            ))}
          </div>
        </>
      )}

      {bg.type === 'image' && (
        <>
          <div className="fld">
            <input
              placeholder="https://… image URL"
              value={bg.url}
              onChange={(e) => onChange({ ...bg, url: e.target.value })}
            />
          </div>
          <DimSlider
            value={bg.dim ?? 0.45}
            onChange={(dim) => onChange({ ...bg, dim })}
          />
        </>
      )}
    </div>
  );
}

/** CSS background value for a color/gradient Background (no image) */
export function bgCss(bg: Background | undefined): string | undefined {
  if (!bg) return undefined;
  if (bg.type === 'color') return bg.color;
  if (bg.type === 'gradient')
    return `linear-gradient(${bg.angle ?? 135}deg, ${bg.from}, ${bg.to})`;
  return undefined;
}
