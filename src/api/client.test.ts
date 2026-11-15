import {afterEach, describe, expect, it, vi} from 'vitest';
import {requestJson} from './client';
import {listServices} from './services';

const publicService = {
  id: '85148c00-ced9-40f4-99f3-4a245ef9ca10',
  key: 'shop',
  name: 'Shop',
  isPublic: true,
  createdAt: '2026-11-14T09:34:40Z',
  updatedAt: '2026-11-14T09:34:40Z',
  endpointUrl: null,
  description: null,
};

afterEach(() => vi.unstubAllGlobals());

describe('coverage API client', () => {
  it('requests the real list contract on the same origin and preserves null values', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json([publicService]));
    vi.stubGlobal('fetch', fetch);
    const {signal} = new AbortController();

    await expect(listServices(signal)).resolves.toEqual([publicService]);
    expect(fetch).toHaveBeenCalledWith('/api/services', expect.objectContaining({
      method: 'GET', credentials: 'same-origin', cache: 'no-store', signal,
    }));
    const headers: Headers = fetch.mock.calls[0][1].headers;
    expect([...headers]).toEqual([['accept', 'application/json']]);
  });

  it('uses an explicitly provided CSRF token for an unsafe request and accepts 204', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, {status: 204}));
    vi.stubGlobal('fetch', fetch);

    await expect(requestJson('/api/auth/logout', data => data, {
      method: 'POST', csrfToken: 'session-token',
    })).resolves.toBeUndefined();
    expect(fetch.mock.calls[0][1].headers.get('X-CSRF-Token')).toBe('session-token');
  });

  it.each([401, 403, 503])('preserves HTTP %s as an API error', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, {status})));
    await expect(listServices()).rejects.toMatchObject({name: 'ApiError', kind: 'http', status});
  });

  it('reports a network failure and propagates cancellation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network failure')));
    await expect(listServices()).rejects.toMatchObject({kind: 'network'});

    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(controller.signal.reason));
    await expect(listServices(controller.signal)).rejects.toBe(controller.signal.reason);
  });

  it.each(['<html></html>', '{}', '[{"id":"mock:customer"}]'])('rejects an invalid payload: %s', async body => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
    await expect(listServices()).rejects.toMatchObject({kind: 'invalid-response', status: 200});
  });

  it('accepts a successful empty catalog', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([])));
    await expect(listServices()).resolves.toEqual([]);
  });
});
