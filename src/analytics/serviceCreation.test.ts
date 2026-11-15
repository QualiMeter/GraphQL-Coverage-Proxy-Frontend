import {afterEach, describe, expect, it, vi} from 'vitest';
import {createService, type ServiceCreate} from '../api/services';
import type {Role, Session} from '../api/auth';
import {canCreateService, serviceCreateError, validateServiceDraft} from './serviceCreation';

const draft = {name: ' Orders ', key: 'orders-v2', endpointUrl: ' https://example.com/graphql ', description: ' ', isPublic: false};
const input: ServiceCreate = {name: 'Orders', key: 'orders-v2', endpointUrl: 'https://example.com/graphql', isPublic: false};
const created = {
  ...input, id: '85148c00-ced9-40f4-99f3-4a245ef9ca10',
  createdAt: '2026-11-14T09:34:40Z', updatedAt: '2026-11-14T09:34:40Z',
};
const session = (role: Role): Session => ({
  user: {id: 'user', username: 'user', role, isActive: true},
  csrfToken: 'fake-for-test',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
});

afterEach(() => vi.unstubAllGlobals());

describe('service creation', () => {
  it('requires an active unexpired operator or admin session', () => {
    expect(canCreateService(null)).toBe(false);
    expect(canCreateService(session('viewer'))).toBe(false);
    expect(canCreateService(session('analyst'))).toBe(false);
    expect(canCreateService(session('operator'))).toBe(true);
    expect(canCreateService(session('admin'))).toBe(true);
    expect(canCreateService({...session('admin'), expiresAt: new Date(0).toISOString()})).toBe(false);
  });

  it('trims input, preserves private default and omits a blank description', () => {
    expect(validateServiceDraft(draft)).toEqual({input});
    expect(validateServiceDraft({...draft, description: ' Shop ', isPublic: true})).toEqual({
      input: {...input, description: 'Shop', isPublic: true},
    });
  });

  it.each([
    ['name', ' '],
    ['key', 'Wrong.key'],
    ['key', '1orders'],
    ['endpointUrl', 'https://name:secret@example.com/graphql'],
    ['endpointUrl', 'https://example.com/graphql?token=example'],
    ['endpointUrl', 'https://example.com/graphql#extra'],
    ['endpointUrl', 'ftp://example.com/graphql'],
    ['description', 'x'.repeat(2001)],
  ] as const)('rejects invalid %s before sending a request', (field, value) => {
    expect(validateServiceDraft({...draft, [field]: value})).toMatchObject({error: {field}});
  });

  it('sends ServiceCreate via the same-origin client with CSRF and returns the confirmed service', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(created, {status: 201}));
    vi.stubGlobal('fetch', fetch);
    await expect(createService(input, 'fake-for-test')).resolves.toEqual(created);
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/services', expect.objectContaining({
      method: 'POST', credentials: 'same-origin', body: JSON.stringify(input),
    }));
    const headers: Headers = fetch.mock.calls[0][1].headers;
    expect(headers.get('X-CSRF-Token')).toBe('fake-for-test');
    expect(headers.has('X-Coverage-Api-Key')).toBe(false);
  });

  it.each([[401, 'Сессия истекла'], [403, 'Проверьте права'], [409, 'ключом уже существует'], [422, 'политикой backend'], [503, 'Проверьте список сервисов']])(
    'reports HTTP %s without retrying the mutation', async (status, message) => {
      const fetch = vi.fn().mockResolvedValue(new Response(null, {status}));
      vi.stubGlobal('fetch', fetch);
      const error = await createService(input, 'fake-for-test').catch((error: unknown) => error);
      expect(error).toMatchObject({status});
      expect(serviceCreateError(error)).toContain(message);
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects an invalid response instead of selecting an unconfirmed service', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({id: 'mock:customer'}, {status: 201})));
    await expect(createService(input, 'fake-for-test')).rejects.toMatchObject({kind: 'invalid-response'});
  });
});
