/* The layout registry — every slide row's `layout` field resolves here.
   Each entry: defaults (used by "add slide" and the skill), an inspector
   field schema, and a Render component that maps props → the premium
   section components with editable text (T) wired in. */
import type { SlideData } from '@/data/types';
import { type LayoutDef } from './shared';
import { coreLayouts } from './core';
import { gridLayouts } from './grids';
import { blockLayouts } from './blocks';
import { mediaLayouts } from './media';
import { freeformLayouts } from './freeform';

export type { LayoutDef, FieldSpec } from './shared';

export const LAYOUTS: Record<string, LayoutDef> = Object.fromEntries(
  [
    ...coreLayouts,
    ...gridLayouts,
    ...mediaLayouts,
    ...blockLayouts,
    ...freeformLayouts,
  ].map((l) => [l.type, l])
);

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
  { title: 'Extras', types: ['canvas', 'team', 'pricing', 'logos', 'code'] },
];

export function RenderLayout({ slide }: { slide: SlideData }) {
  const def = LAYOUTS[slide.layout];
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
