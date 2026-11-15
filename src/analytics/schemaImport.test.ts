import {afterEach, describe, expect, it, vi} from 'vitest';
import {importSchemaIntrospection, importSchemaSdl} from '../api/schemas';
import {readSchemaFile, schemaImportError, validateSchemaSdl} from './schemaImport';

const serviceId = '85148c00-ced9-40f4-99f3-4a245ef9ca10';
const sdl = 'type Query { hello: String }';
const snapshot = {
  id: '058c02de-e7f7-47ab-8b2e-21aac40d7f2c', serviceId, source: 'sdl',
  createdAt: '2026-11-14T09:34:40Z', schemaHash: 'fixture-hash',
};

afterEach(() => vi.unstubAllGlobals());

describe('snapshot import', () => {
  it('sends file SDL as JSON with the selected service and CSRF token', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(snapshot, {status: 201}));
    vi.stubGlobal('fetch', fetch);
    const text = await readSchemaFile(new File([sdl], 'Store.GQL'));
    await expect(importSchemaSdl(serviceId, validateSchemaSdl(text), 'test-csrf')).resolves.toEqual(snapshot);
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/schemas/import', expect.objectContaining({
      method: 'POST', credentials: 'same-origin', body: JSON.stringify({serviceId, sdl}),
    }));
    expect(fetch.mock.calls[0][1].headers.get('X-CSRF-Token')).toBe('test-csrf');
    expect(validateSchemaSdl(`  ${sdl}\n`)).toBe(sdl);
  });

  it('passes only the selected service ID to introspection', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({...snapshot, source: 'introspection'}, {status: 201}));
    vi.stubGlobal('fetch', fetch);
    await expect(importSchemaIntrospection(serviceId, 'test-csrf')).resolves.toMatchObject({id: snapshot.id});
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/schemas/import/introspection', expect.objectContaining({
      method: 'POST', credentials: 'same-origin', body: JSON.stringify({serviceId}),
    }));
    expect(fetch.mock.calls[0][1].headers.get('X-CSRF-Token')).toBe('test-csrf');
  });

  it('validates SDL syntax, document type, length, extension, and encoding', async () => {
    expect(() => validateSchemaSdl(' ')).toThrow(/Файл SDL пуст/);
    expect(() => validateSchemaSdl('type Query {')).toThrow(/синтаксис/);
    expect(() => validateSchemaSdl('query { hello }')).toThrow(/Ожидается схема SDL/);
    expect(() => validateSchemaSdl('x'.repeat(1_000_001))).toThrow(/1 000 000/);
    await expect(readSchemaFile(new File([sdl], 'schema.txt'))).rejects.toThrow(/\.graphql/);
    await expect(readSchemaFile(new File([Uint8Array.of(0xff)], 'schema.graphql'))).rejects.toThrow(/UTF-8/);
  });

  it.each([[401, /Сессия истекла/], [403, /Проверьте права/], [404, /недоступен/], [413, /слишком большой/], [422, /отклонил данные/]])(
    'maps backend HTTP %s for the dialog', async (status, message) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({detail: 'internal detail'}, {status})));
      const error = await importSchemaSdl(serviceId, sdl, 'test-csrf').catch((error: unknown) => error);
      expect(schemaImportError(error)).toMatch(message);
      expect(schemaImportError(error)).not.toContain('internal detail');
    },
  );

  it('offers SDL when introspection is disabled without disclosing the upstream response', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({
      code: 'INTROSPECTION_DISABLED', detail: 'private upstream detail',
    }, {status: 409}));
    vi.stubGlobal('fetch', fetch);
    const error = await importSchemaIntrospection(serviceId, 'test-csrf').catch((error: unknown) => error);
    expect(error).toMatchObject({status: 409, code: 'INTROSPECTION_DISABLED'});
    expect(schemaImportError(error)).toContain('Импортируйте схему через SDL');
    expect(schemaImportError(error)).not.toContain('private upstream detail');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects a snapshot belonging to another service', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({...snapshot, serviceId: 'other'}, {status: 201})));
    await expect(importSchemaIntrospection(serviceId, 'test-csrf')).rejects.toMatchObject({kind: 'invalid-response'});
  });
});
