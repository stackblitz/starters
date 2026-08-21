/* The deck as data. Slides are rows in Postgres (supabase/schema.sql); `props`
   is the layout-specific payload rendered by src/layouts/registry.tsx. */

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
  /** speaker notes — never sent to the audience view (supabase/functions/deck) */
  notes: string;
  status: SlideStatus;
}

/** Public, or only for whoever holds a link. */
export type Visibility = 'public' | 'link';

export interface DeckMeta {
  title: string;
  transition: TransitionMode;
  font?: string;
  /** deck-wide accent override (null/absent = the tokens.css default) */
  accent?: string | null;
  /** who may open the published deck without a link */
  visibility?: Visibility;
  /** origin of the published site, null until it has been published — the base
      every shareable link is built on, because this app's own address is not
      one anybody else can open (see ShareModal) */
  publish_url?: string | null;
}

/** A share link as the deck function reports it. The password is never sent. */
export interface ShareLink {
  mode: 'edit' | 'presenter' | 'present';
  token: string;
  hasPassword: boolean;
  created_at?: string;
}

/** What the deck function says this visitor may do. Never inferred locally. */
export interface DeckAccess {
  mode: 'edit' | 'presenter' | 'present';
  canEdit: boolean;
  owner: boolean;
}

export interface AppState {
  deck: DeckMeta;
  slides: SlideData[];
}
