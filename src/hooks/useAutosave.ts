import { useCallback, useEffect, useRef, useState } from 'react';

export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'error';

interface Options<T> {
  data: T | null;
  save: (value: T) => Promise<void>;
  delayMs?: number;
  enabled?: boolean;
}

interface Result {
  status: SyncStatus;
  flush: () => Promise<void>;
  errorMessage: string | null;
}

export function useAutosave<T>({ data, save, delayMs = 400, enabled = true }: Options<T>): Result {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pendingRef = useRef<T | null>(null);
  const inFlightRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef<T | null>(null);

  const run = useCallback(async () => {
    if (inFlightRef.current) return;
    const next = pendingRef.current;
    if (next === null) return;
    pendingRef.current = null;
    inFlightRef.current = true;
    setStatus('syncing');
    try {
      await save(next);
      savedRef.current = next;
      setErrorMessage(null);
      setStatus(pendingRef.current ? 'syncing' : 'saved');
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
      setStatus('error');
    } finally {
      inFlightRef.current = false;
      if (pendingRef.current !== null) {
        void run();
      }
    }
  }, [save]);

  useEffect(() => {
    if (!enabled || data === null) return;
    // Treat the first non-null data as the already-saved baseline — never
    // echo fetched data straight back to the server. Without this, an admin
    // page-load followed by an external edit to data.json (e.g. manual paste
    // of a migration) would be overwritten with the pre-paste snapshot.
    if (savedRef.current === null) {
      savedRef.current = data;
      return;
    }
    if (savedRef.current === data) return;
    pendingRef.current = data;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void run();
    }, delayMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, delayMs, enabled, run]);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await run();
  }, [run]);

  return { status, flush, errorMessage };
}
