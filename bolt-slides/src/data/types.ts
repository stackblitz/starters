/* The deck as data. Slides are rows in the database; `props` is the
   layout-specific payload rendered by src/layouts/registry.tsx. */

export type Background =
  | { type: 'none' }
  | { type: 'color'; color: string }
  | { type: 'gradient'; from: string; to: string; angle?: number }
  | { type: 'image'; url: string; dim?: number }; // dim 0..1 darkens under a scrim

/* How a slide's content enters when it becomes active:
   cascade = each layout's designed stagger (default) · rise/fade/zoom = the
   whole slide enters as one · none = instant. */
export type AnimationMode = 'cascade' | 'rise' | 'fade' | 'zoom' | 'none';

/* How the deck moves between slides. Per-slide `transition` overrides the
   deck default (null = inherit). */
export type TransitionMode = 'fade' | 'slide' | 'rise' | 'zoom' | 'none';

export type SlideStatus =
  | 'none'
  | 'draft'
  | 'in-progress'
  | 'review'
  | 'approved';

export const STATUSES: { value: SlideStatus; label: string; color: string }[] =
  [
    { value: 'none', label: 'None', color: 'transparent' },
    { value: 'draft', label: 'Draft', color: '#9aa4b2' },
    { value: 'in-progress', label: 'In progress', color: '#eab308' },
    { value: 'review', label: 'In review', color: '#38bdf8' },
    { value: 'approved', label: 'Approved', color: '#4fe5b0' },
  ];

export const ANIMATIONS: AnimationMode[] = [
  'cascade',
  'rise',
  'fade',
  'zoom',
  'none',
];
export const TRANSITIONS: TransitionMode[] = [
  'fade',
  'slide',
  'rise',
  'zoom',
  'none',
];

export interface SlideData {
  id: string;
  position: number;
  layout: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: any;
  background: Background;
  animation: AnimationMode;
  transition: TransitionMode | null;
  nav: string | null;
  notes: string;
  status: SlideStatus;
}

export interface DeckMeta {
  title: string;
  transition: TransitionMode;
  font?: string;
  /** deck-wide accent override (null/absent = the tokens.css default) */
  accent?: string | null;
}

export interface AppState {
  deck: DeckMeta;
  slides: SlideData[];
}
