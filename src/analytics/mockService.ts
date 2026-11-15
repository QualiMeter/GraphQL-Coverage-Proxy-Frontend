export const MOCK_SERVICE_ID = 'mock:customer';

export function isMockService(id: string): boolean {
  return id === MOCK_SERVICE_ID;
}
