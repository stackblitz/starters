/* The layout registry — every slide row's `layout` field resolves here.
   Each entry: defaults (used by "add slide" and the skill), an inspector
   field schema, and a Render component that maps props → the premium
   section components with editable text (T) wired in. */
import type { SlideData } from '../data/types';
import { type LayoutDef } from './shared';
import { coreLayouts } from './core';
import { gridLayouts } from './grids';
import { blockLayouts } from './blocks';
import { mediaLayouts } from './media';
/* freeformLayouts (type 'canvas') is intentionally omitted — the files
   stay in the repo for a future rework. Do not wire it back in here. */

export type { LayoutDef, FieldSpec } from './shared';

export const LAYOUTS: Record<string, LayoutDef> = Object.fromEntries(
  [...coreLayouts, ...gridLayouts, ...mediaLayouts, ...blockLayouts].map(
    (l) => [l.type, l]
  )
);

function aliasKeys(type: string): string[] {
  const kebab = type.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
  const snake = type.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
  return [type.toLowerCase(), kebab, snake];
}

const LAYOUT_ALIASES: Record<string, string> = {};
for (const type of Object.keys(LAYOUTS)) {
  for (const a of aliasKeys(type)) LAYOUT_ALIASES[a] = type;
}

/** Map a slide's layout field to a registry key. Agents often write
 *  kebab-case (`big-number`) or put the name on `type` instead of `layout`. */
export function resolveLayoutType(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return '';
  const name = raw.trim();
  if (LAYOUTS[name]) return name;
  return LAYOUT_ALIASES[name] ?? LAYOUT_ALIASES[name.toLowerCase()] ?? name;
}

export const LAYOUT_LIST = Object.values(LAYOUTS);

/* add-slide modal grouping — order here is display order */
export const LAYOUT_GROUPS: { title: string; types: string[] }[] = [
  {
    title: 'Open & close',
    types: ['cover', 'section', 'statement', 'manifesto', 'quote'],
  },
  {
    title: 'Story',
    types: ['poster', 'story', 'speaker', 'persona', 'contrast', 'chat'],
  },
  {
    title: 'Data',
    types: [
      'bigNumber',
      'figures',
      'statGrid',
      'chart',
      'insight',
      'table',
      'comparison',
    ],
  },
  {
    title: 'Structure',
    types: [
      'agenda',
      'pillars',
      'steps',
      'timeline',
      'bento',
      'qa',
      'accordion',
      'tabs',
    ],
  },
  { title: 'Extras', types: ['team', 'pricing', 'logos', 'code'] },
];

export function RenderLayout({ slide }: { slide: SlideData }) {
  const def = LAYOUTS[resolveLayoutType(slide.layout)];
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
