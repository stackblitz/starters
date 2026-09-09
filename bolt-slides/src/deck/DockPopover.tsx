import { useMemo, useState, type ReactNode } from 'react';
import { DockPopoverContext } from './dockPopoverContext';

export function DockPopoverProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ host, setHost }), [host]);

  return (
    <DockPopoverContext.Provider value={value}>
      {children}
    </DockPopoverContext.Provider>
  );
}
