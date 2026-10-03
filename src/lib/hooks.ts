import { useCallback, useEffect, useRef, useState } from 'react';
import { db, type ListOpts } from './db';
import type { TableMap, TableName } from './types';

/** Charge une table (filtrée) et se met à jour automatiquement en cas de changement. */
export function useTable<T extends TableName>(table: T, filter?: Partial<TableMap[T]> | null, opts?: ListOpts) {
  const [rows, setRows] = useState<TableMap[T][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify([table, filter, opts]);
  const keyRef = useRef(key);
  keyRef.current = key;

  const reload = useCallback(async () => {
    if (filter === null) {
      setRows([]);
      setLoading(false);
      return;
    }
    const k = key;
    try {
      const data = await db.list(table, filter ?? {}, opts);
      if (keyRef.current === k) {
        setRows(data);
        setError(null);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    setLoading(true);
    void reload();
    return db.subscribe([table], () => void reload());
  }, [reload, table]);

  return { rows, loading, error, reload };
}

export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(i);
  }, [intervalMs]);
  return now;
}

export function useLocalPref<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem('tc_pref_' + key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('tc_pref_' + key, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  }, [key, v]);
  return [v, setV] as const;
}
