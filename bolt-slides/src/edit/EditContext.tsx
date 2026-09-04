import { createContext, useContext } from 'react';
import type { SlideData } from '../data/types';

export interface EditCtxValue {
  editable: boolean;
  slideId: string | null;
  slide?: SlideData | null;
}

export const EditCtx = createContext<EditCtxValue>({
  editable: false,
  slideId: null,
  slide: null,
});

export const useEdit = () => useContext(EditCtx);
