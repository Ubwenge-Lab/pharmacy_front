import {
  abortable,
  cachedRequest,
  clearRequestCache,
  invalidateRequest,
} from '@/lib/requestCache';

describe('requestCache', () => {
  beforeEach(() => {
    clearRequestCache();
    jest.useRealTimers();
  });

  it('shares one in-flight request between concurrent callers', async () => {
    const fetcher = jest.fn().mockResolvedValue('a');
    const [x, y, z] = await Promise.all([
      cachedRequest('k', fetcher),
      cachedRequest('k', fetcher),
      cachedRequest('k', fetcher),
    ]);
    expect([x, y, z]).toEqual(['a', 'a', 'a']);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('reuses the result inside the TTL and refetches after it', async () => {
    jest.useFakeTimers();
    const fetcher = jest.fn().mockResolvedValueOnce('one').mockResolvedValueOnce('two');
    await cachedRequest('k', fetcher, { ttlMs: 1000 });
    await cachedRequest('k', fetcher, { ttlMs: 1000 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1001);
    expect(await cachedRequest('k', fetcher, { ttlMs: 1000 })).toBe('two');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('ttl 0 only shares in-flight requests', async () => {
    const fetcher = jest.fn().mockResolvedValue('v');
    await cachedRequest('k', fetcher);
    await cachedRequest('k', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('force skips the TTL but still joins an in-flight request', async () => {
    const fetcher = jest.fn().mockResolvedValue('v');
    await cachedRequest('k', fetcher, { ttlMs: 60_000 });
    await cachedRequest('k', fetcher, { ttlMs: 60_000, force: true });
    expect(fetcher).toHaveBeenCalledTimes(2);

    clearRequestCache();
    fetcher.mockClear();
    await Promise.all([
      cachedRequest('k', fetcher, { force: true }),
      cachedRequest('k', fetcher, { force: true }),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not cache errors', async () => {
    const fetcher = jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('ok');
    await expect(cachedRequest('k', fetcher, { ttlMs: 60_000 })).rejects.toThrow('boom');
    expect(await cachedRequest('k', fetcher, { ttlMs: 60_000 })).toBe('ok');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('invalidate and clear drop cached values', async () => {
    const fetcher = jest.fn().mockResolvedValue('v');
    await cachedRequest('a', fetcher, { ttlMs: 60_000 });
    invalidateRequest('a');
    await cachedRequest('a', fetcher, { ttlMs: 60_000 });
    expect(fetcher).toHaveBeenCalledTimes(2);

    await cachedRequest('b', fetcher, { ttlMs: 60_000 });
    clearRequestCache();
    await cachedRequest('b', fetcher, { ttlMs: 60_000 });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('a response that lands after a clear is not stored (logout during a request)', async () => {
    let resolveOld: (v: string) => void = () => {};
    const old = jest.fn().mockImplementation(() => new Promise<string>((r) => (resolveOld = r)));
    const pending = cachedRequest('k', old, { ttlMs: 60_000 });
    clearRequestCache();
    resolveOld('previous user');
    await pending;
    const fresh = jest.fn().mockResolvedValue('new user');
    expect(await cachedRequest('k', fresh, { ttlMs: 60_000 })).toBe('new user');
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it('abortable rejects only the aborting caller', async () => {
    const shared = cachedRequest('k', () => new Promise<string>((r) => setTimeout(() => r('v'), 10)));
    const ctrl = new AbortController();
    const mine = abortable(shared, ctrl.signal);
    ctrl.abort();
    await expect(mine).rejects.toMatchObject({ code: 'ERR_CANCELED', name: 'AbortError' });
    await expect(shared).resolves.toBe('v');
  });
});
