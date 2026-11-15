import {requestJson} from './client';

export type ServiceCreate = {
  key: string;
  name: string;
  endpointUrl: string;
  description?: string | null;
  isPublic?: boolean;
};

export type ServiceOut = {
  id: string;
  key: string;
  name: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  endpointUrl?: string | null;
  description?: string | null;
};

const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const nullableString = (value: unknown) => value == null || typeof value === 'string';

function isService(data: unknown): data is ServiceOut {
  if (!data || typeof data !== 'object') return false;
  const service = data as Record<string, unknown>;
  return typeof service.id === 'string' && uuid.test(service.id) &&
    typeof service.key === 'string' && typeof service.name === 'string' &&
    typeof service.isPublic === 'boolean' && typeof service.createdAt === 'string' &&
    typeof service.updatedAt === 'string' && nullableString(service.endpointUrl) &&
    nullableString(service.description);
}

function decodeServices(data: unknown): ServiceOut[] {
  if (!Array.isArray(data) || !data.every(isService)) throw new Error('Expected ServiceOut[]');
  return data;
}

export function listServices(signal?: AbortSignal): Promise<ServiceOut[]> {
  return requestJson('/api/services', decodeServices, {signal});
}

export function createService(input: ServiceCreate, csrfToken: string): Promise<ServiceOut> {
  return requestJson('/api/services', data => {
    if (!isService(data)) throw new Error('Expected ServiceOut');
    return data;
  }, {method: 'POST', body: input, csrfToken});
}
