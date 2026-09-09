import { createContext, useContext } from 'react';
import type { SlideData } from '../data/types';

export interface SlideScopeValue {
  slideId: string | null;
  slide?: SlideData | null;
}

export const SlideScope = createContext<SlideScopeValue>({
  slideId: null,
  slide: null,
});

export const useSlide = () => useContext(SlideScope);
