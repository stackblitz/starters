import { createContext, useContext } from 'react';

/* Shared state for click-builds. The live slide gets {clicks, isStatic:false,
   registerMax}; thumbnails/previews get {isStatic:true} so every build shows
   at once with no animation. Default is static so components render fine even
   outside a <Deck>. */
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
