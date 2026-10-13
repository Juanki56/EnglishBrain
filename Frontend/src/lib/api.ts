/**
 * Cliente de la API del Backend. Adjunta el access token de la sesión,
 * traduce las respuestas de error `{ error: { code, message, details } }` a
 * ApiError y avisa cuando la sesión deja de ser válida (401).
 */
export interface ErrorDetail {
  field: string;
  message: string;
}

export class ApiError extends Error {
  override name = 'ApiError';

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: ErrorDetail[] = [],
  ) {
    super(message);
  }
}

export const NETWORK_ERROR_MESSAGE = 'No se pudo conectar con el servidor. ¿Está encendido el Backend?';

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  /** Se llama ante un 401 (sesión caducada o cerrada). */
  onUnauthorized?: () => void;
  /**
   * Una petición lleva más de `slowAfterMs` sin terminar (el servidor gratuito
   * puede estar despertando). `onSlowEnd` se llama cuando esa petición termina,
   * con éxito, error o cancelación.
   */
  onSlowStart?: () => void;
  onSlowEnd?: () => void;
  slowAfterMs?: number;
  fetchImpl?: typeof fetch;
}

/** A partir de cuánto una petición se considera lenta (design D3 de deploy-render-vercel). */
export const SLOW_REQUEST_MS = 4000;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Cuerpo JSON. */
  body?: unknown;
  /** Cuerpo multipart (subida de archivos). */
  formData?: FormData;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient({
  baseUrl,
  getAccessToken,
  onUnauthorized,
  onSlowStart,
  onSlowEnd,
  slowAfterMs = SLOW_REQUEST_MS,
  fetchImpl = fetch,
}: ApiClientOptions) {
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    let slow = false;
    const timer = onSlowStart
      ? setTimeout(() => {
          slow = true;
          onSlowStart();
        }, slowAfterMs)
      : undefined;
    try {
      return await send<T>(path, options);
    } finally {
      clearTimeout(timer);
      if (slow) onSlowEnd?.();
    }
  }

  async function send<T>(path: string, { method = 'GET', body, formData, query, signal }: RequestOptions): Promise<T> {
    const url = new URL(baseUrl + path);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }

    const token = await getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let response: Response;
    try {
      response = await fetchImpl(url, {
        method,
        headers,
        body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
        signal,
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw error;
      throw new ApiError(0, 'network_error', NETWORK_ERROR_MESSAGE);
    }

    if (response.status === 204) return undefined as T;

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401) onUnauthorized?.();
      const error = (payload as { error?: { code?: string; message?: string; details?: ErrorDetail[] } } | null)?.error;
      throw new ApiError(
        response.status,
        error?.code ?? 'http_error',
        error?.message ?? `El servidor respondió con un error (${response.status})`,
        error?.details ?? [],
      );
    }
    return payload as T;
  }

  return {
    request,
    get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...options, method: 'GET' }),
    post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...options, method: 'POST', body }),
    put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
    patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
    delete: <T = void>(path: string) => request<T>(path, { method: 'DELETE' }),
  };
}

/** Errores por campo de un ApiError, listos para pasarlos a los Input: `{ word: 'La palabra es obligatoria' }`. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  return Object.fromEntries(error.details.filter((d) => d.field !== '_general').map((d) => [d.field, d.message]));
}

/** Mensaje general para mostrar arriba del formulario. */
export function generalMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const general = error.details.find((d) => d.field === '_general');
    return general?.message ?? error.message;
  }
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}
