import { useCallback, useEffect, useRef, useState } from 'react';

import { CmsBridgeError } from './bridge/client';

export interface AsyncState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  refetch: () => Promise<void>;
  setData: (updater: T | ((prev: T | undefined) => T)) => void;
}

/**
 * Minimal async data hook. `deps` re-run the fetcher; `refetch` re-runs it
 * manually after a mutation. Keeps the admin free of a query library.
 */
export function useAsync<T>(
  fetcher: () => Promise<T>,
  deps: unknown[]
): AsyncState<T> {
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const seq = useRef(0);

  const run = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (id === seq.current) setDataState(result);
    } catch (e) {
      if (id === seq.current) setError(errorMessage(e));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((updater: T | ((prev: T | undefined) => T)) => {
    setDataState((prev) =>
      typeof updater === 'function'
        ? (updater as (p: T | undefined) => T)(prev)
        : updater
    );
  }, []);

  return { data, error, loading, refetch: run, setData };
}

export function errorMessage(e: unknown): string {
  if (e instanceof CmsBridgeError)
    return e.code ? `${e.message} (${e.code})` : e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}

/** Debounce a changing value (search inputs). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
