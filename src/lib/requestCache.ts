// src/lib/requestCache.ts
//
// One owner for shared GET data. Components that need the same endpoint call
// the same service function, and the service function goes through
// cachedRequest(), so concurrent callers share one in-flight request and
// callers inside the TTL share one result.
//
// Rules:
//   - Errors are never cached. The next caller retries.
//   - Data that belongs to a user must be cleared on login and logout.
//     setAuthTokens and removeAuthTokens in lib/auth.ts call clearRequestCache().
//   - A mutation that changes cached data calls invalidateRequest(key).
//   - force: true skips the TTL but still joins a request that is already in
//     flight, so two pollers firing together make one call.

interface Entry {
  hasValue: boolean;
  value?: unknown;
  expiresAt: number;
  inflight?: Promise<unknown>;
}

const store = new Map<string, Entry>();

export interface CachedRequestOptions {
  /** How long a successful result is reused. 0 means in-flight sharing only. */
  ttlMs?: number;
  /** Skip the TTL and fetch again (still joins an in-flight request). */
  force?: boolean;
}

export function cachedRequest<T>(
  key: string,
  fetcher: () => Promise<T>,
  { ttlMs = 0, force = false }: CachedRequestOptions = {},
): Promise<T> {
  const existing = store.get(key);

  if (existing) {
    if (existing.inflight) return existing.inflight as Promise<T>;
    if (!force && existing.hasValue && existing.expiresAt > Date.now()) {
      return Promise.resolve(existing.value as T);
    }
  }

  const entry: Entry = { hasValue: false, expiresAt: 0 };
  store.set(key, entry);

  const request = fetcher().then(
    (value) => {
      // Only store if this entry is still the current one. An invalidate or a
      // clear during the request must not be overwritten by a stale response.
      if (store.get(key) === entry) {
        entry.hasValue = true;
        entry.value = value;
        entry.expiresAt = Date.now() + ttlMs;
        entry.inflight = undefined;
      }
      return value;
    },
    (error) => {
      if (store.get(key) === entry) store.delete(key);
      throw error;
    },
  );

  entry.inflight = request;
  return request;
}

/** Drop one key. The next caller fetches again. */
export function invalidateRequest(key: string): void {
  store.delete(key);
}

/** Drop everything. Called on login and logout so users never see each other's data. */
export function clearRequestCache(): void {
  store.clear();
}

/**
 * Lets a caller keep its AbortController while sharing a request. Aborting
 * rejects this caller only. The shared request keeps running for the others.
 * The rejection carries code ERR_CANCELED, which existing catch blocks check.
 */
export function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () =>
      reject(Object.assign(new Error('canceled'), { name: 'AbortError', code: 'ERR_CANCELED' }));
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}
