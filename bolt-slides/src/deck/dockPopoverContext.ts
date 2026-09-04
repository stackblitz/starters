import { createContext, useContext } from 'react';

export type DockPopoverContextValue = {
  host: HTMLElement | null;
  setHost: (node: HTMLElement | null) => void;
};

export const DockPopoverContext =
  createContext<DockPopoverContextValue | null>(null);

export function useDockPopoverHost() {
  return useContext(DockPopoverContext);
}
