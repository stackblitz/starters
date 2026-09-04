import type { SlideData } from '../data/types';
import { type LayoutDef } from './shared';
import { coreLayouts } from './core';
import { gridLayouts } from './grids';
import { blockLayouts } from './blocks';
import { mediaLayouts } from './media';
import { LAYOUT_NAMES, type LayoutName } from '../data/layoutProps';

export type { LayoutName, LayoutProps } from '../data/layoutProps';
export type { LayoutDef } from './shared';

export const LAYOUTS: Record<string, LayoutDef> = Object.fromEntries(
  [...coreLayouts, ...gridLayouts, ...mediaLayouts, ...blockLayouts].map(
    (l) => [l.type, l]
  )
);

const missing = LAYOUT_NAMES.filter((name) => !LAYOUTS[name]);

if (missing.length) {
  throw new Error(`LAYOUTS missing LayoutName: ${missing.join(', ')}`);
}

const extra = Object.keys(LAYOUTS).filter(
  (name) => !LAYOUT_NAMES.includes(name as LayoutName)
);

if (extra.length) {
  throw new Error(`LAYOUTS has untyped layouts: ${extra.join(', ')}`);
}

function aliasKeys(type: string): string[] {
  const kebab = type.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
  const snake = type.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
  return [type.toLowerCase(), kebab, snake];
}

const LAYOUT_ALIASES: Record<string, string> = {};

for (const type of Object.keys(LAYOUTS)) {
  for (const a of aliasKeys(type)) LAYOUT_ALIASES[a] = type;
}

export function resolveLayoutType(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return '';

  const name = raw.trim();

  if (LAYOUTS[name]) return name;

  return LAYOUT_ALIASES[name] ?? LAYOUT_ALIASES[name.toLowerCase()] ?? name;
}

export function RenderLayout({ slide }: { slide: SlideData }) {
  const type = resolveLayoutType(slide.layout);
  const def = LAYOUTS[type];

  if (!def) {
    return (
      <div className="slide center">
        <div className="kicker">Unknown layout</div>
        <h2 className="headline">“{slide.layout}”</h2>
      </div>
    );
  }

  return <def.Render slide={slide} />;
}
