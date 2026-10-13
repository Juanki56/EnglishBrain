import { useCallback, useEffect, useState } from 'react';
import { generalMessage } from '../lib/api';
import { useApi } from './useApi';

type Query = Record<string, string | number | boolean | undefined | null>;

/**
 * Carga un GET del Backend con sus estados (cargando, error, datos).
 * `setData` permite actualizarlo al instante tras un cambio local;
 * `reload` lo vuelve a pedir (botón "Reintentar").
 */
export function useResource<T>(path: string, query?: Query) {
  const api = useApi();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const queryKey = JSON.stringify(query ?? {});

  useEffect(() => {
    let current = true;
    setError('');
    api
      .get<T>(path, { query: JSON.parse(queryKey) as Query })
      .then((result) => current && setData(result))
      .catch((err) => current && setError(generalMessage(err)));
    return () => {
      current = false;
    };
  }, [api, path, queryKey, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, setData, error, loading: data === null && !error, reload };
}
