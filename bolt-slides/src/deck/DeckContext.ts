import { createContext, useContext } from 'react';

export type DeckCtxValue = {
  clicks: number;
  isStatic: boolean;
  registerMax?: (at: number) => void;
};

export const DeckCtx = createContext<DeckCtxValue>({
  clicks: 9999,
  isStatic: true,
});

export const useDeck = () => useContext(DeckCtx);
