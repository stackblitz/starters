export type { LayoutName, LayoutProps, LayoutPropsByName } from './layoutProps';

export type Background =
  | { type: 'none' }
  | { type: 'color'; color: string }
  | { type: 'gradient'; from: string; to: string; angle?: number }
  | { type: 'image'; url: string; dim?: number }; // dim 0..1 darkens under a scrim

export type AnimationMode = 'cascade' | 'rise' | 'fade' | 'zoom' | 'none';

export type TransitionMode = 'fade' | 'slide' | 'rise' | 'zoom' | 'none';

export type SlideStatus =
  | 'none'
  | 'draft'
  | 'in-progress'
  | 'review'
  | 'approved';

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
  accent?: string | null;
}

export interface AppState {
  deck: DeckMeta;
  slides: SlideData[];
}

export interface DeckFile {
  boltSlidesVersion: number;
  boltSlidesId?: string | null;
  deck: DeckMeta;
  slides: SlideData[];
}
