import {createServer as httpServer, request, type IncomingHttpHeaders, type Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest';
import {createServer, type ProxyOptions, type ViteDevServer} from 'vite';
import {developmentApiConfig, LOCAL_ORIGIN, PRODUCTION_ORIGIN} from './apiProxy';

const enabled = {COVERAGE_DEV_PROXY_PRODUCTION_AUTH: 'true', COVERAGE_API_PROXY_TARGET: PRODUCTION_ORIGIN};
const development = {command: 'serve', mode: 'development'} as const;
const proxyFor = (env: Record<string, string | undefined>) => Object.values(developmentApiConfig(development, env).server!.proxy!)[0] as ProxyOptions;

describe('development proxy configuration', () => {
  it.each([{}, {COVERAGE_DEV_PROXY_PRODUCTION_AUTH: 'false'}, {COVERAGE_DEV_PROXY_PRODUCTION_AUTH: 'TRUE'}])('does not grant production auth without literal opt-in: %j', env => {
    expect(proxyFor(env).configure).toBeUndefined();
  });

  it('keeps an ordinary custom backend target available without production auth', () => {
    expect(proxyFor({COVERAGE_API_PROXY_TARGET: 'http://localhost:8000'}).target).toBe('http://localhost:8000');
  });

  it.each(['http://graphql.rebyte.fun', 'https://evil.example', `${PRODUCTION_ORIGIN}/api`, `${PRODUCTION_ORIGIN}@evil.example`])('rejects an unsafe auth target: %s', target => {
    expect(() => proxyFor({...enabled, COVERAGE_API_PROXY_TARGET: target})).toThrow(/requires/);
  });

  it('requires development mode', () => {
    expect(() => developmentApiConfig({...development, mode: 'production'}, enabled)).toThrow(/development mode/);
  });

  it.each([
    {command: 'build', mode: 'production'},
    {command: 'build', mode: 'development'},
    {...development, isPreview: true},
  ] as const)('never installs the proxy for build or preview: %j', configEnv => {
    expect(developmentApiConfig(configEnv, enabled)).toEqual({preview: {proxy: {}}});
  });

  it.each([{host: '0.0.0.0'}, {host: true}, {port: 5174}, {strictPort: false}, {cors: true}, {middlewareMode: true}])('rejects unsafe final settings, including CLI overrides: %j', async override => {
    const config = developmentApiConfig(development, enabled);
    await expect(createServer({configFile: false, envFile: false, ...config, server: {...config.server, ...override}})).rejects.toThrow(/requires http:\/\/localhost:5173/);
  });

  it('only rewrites Origin in the proxy hook for a trusted local request', () => {
    const on = vi.fn();
    const proxy = proxyFor(enabled);
    proxy.configure!({on} as never, proxy);
    const callback = on.mock.calls[0][1];
    for (const [headers, remoteAddress, expected] of [
      [{host: 'localhost:5173', origin: LOCAL_ORIGIN}, '127.0.0.1', true],
      [{host: 'localhost:5173', origin: LOCAL_ORIGIN, 'sec-fetch-site': 'cross-site'}, '127.0.0.1', false],
      [{host: 'localhost:5173', origin: 'https://evil.example'}, '127.0.0.1', false],
      [{host: 'localhost:5173'}, '127.0.0.1', false],
      [{host: 'evil.example:5173', origin: LOCAL_ORIGIN}, '127.0.0.1', false],
      [{host: 'localhost:5173', origin: LOCAL_ORIGIN}, '192.168.1.20', false],
    ] as const) {
      const setHeader = vi.fn();
      callback({setHeader}, {headers, socket: {remoteAddress}});
      expect(setHeader.mock.calls).toEqual(expected ? [['Origin', PRODUCTION_ORIGIN]] : []);
    }
  });
});

// A disposable in-memory HTTP upstream only. No production requests or database.
describe('HTTP proxy boundary', () => {
  let upstream: Server;
  let vite: ViteDevServer;
  const received = vi.fn();
  const cookies = ['__Host-coverage_session=fixture; Path=/; Secure; HttpOnly; SameSite=Lax', 'other=fixture; Path=/; Secure; HttpOnly; SameSite=Strict'];

  beforeAll(async () => {
    upstream = httpServer((req, res) => {
      received(req.headers, req.url, req.method);
      res.writeHead(200, {'Content-Type': 'application/json', 'Set-Cookie': cookies});
      res.end(JSON.stringify({origin: req.headers.origin ?? null}));
    });
    await new Promise<void>((resolve, reject) => {
      upstream.once('error', reject);
      upstream.listen(0, '127.0.0.1', resolve);
    });
    const config = developmentApiConfig(development, enabled);
    // Only this test substitutes the validated production target with its local fixture.
    const proxy = Object.values(config.server!.proxy!)[0] as ProxyOptions;
    proxy.target = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
    vite = await createServer({configFile: false, envFile: false, ...config, logLevel: 'silent'});
    await vite.listen();
  });

  afterAll(async () => {
    await vite?.close();
    if (upstream?.listening) await new Promise<void>((resolve, reject) => upstream.close(error => error ? reject(error) : resolve()));
  });

  function send(method: string, headers: IncomingHttpHeaders = {}, path = '/api/auth/logout') {
    return new Promise<{status: number; headers: IncomingHttpHeaders; body: string}>((resolve, reject) => {
      const req = request(`${LOCAL_ORIGIN}${path}`, {method, headers}, res => {
        let body = '';
        res.setEncoding('utf8').on('data', chunk => {body += chunk});
        res.on('end', () => resolve({status: res.statusCode!, headers: res.headers, body}));
      });
      req.on('error', reject);
      req.end();
    });
  }

  it('forwards Cookie, CSRF and other headers; preserves every Set-Cookie attribute', async () => {
    const response = await send('POST', {
      origin: LOCAL_ORIGIN, 'sec-fetch-site': 'same-origin',
      cookie: '__Host-coverage_session=fixture', 'x-csrf-token': 'fixture-csrf', 'x-request-id': 'fixture-request',
    });
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body).origin).toBe(PRODUCTION_ORIGIN);
    expect(received).toHaveBeenLastCalledWith(expect.objectContaining({
      origin: PRODUCTION_ORIGIN, cookie: '__Host-coverage_session=fixture',
      'x-csrf-token': 'fixture-csrf', 'x-request-id': 'fixture-request', 'sec-fetch-site': 'same-origin',
    }), '/api/auth/logout', 'POST');
    expect(response.headers['set-cookie']).toEqual(cookies);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it.each([
    ['GET', {origin: 'https://evil.example'}],
    ['POST', {origin: 'http://localhost:5174'}],
    ['POST', {origin: 'null'}],
    ['POST', {origin: PRODUCTION_ORIGIN}],
    ['POST', {}],
    ['POST', {'sec-fetch-site': 'same-origin'}],
    ['POST', {origin: LOCAL_ORIGIN, 'sec-fetch-site': 'cross-site'}],
    ['GET', {'sec-fetch-site': 'cross-site'}],
    ['GET', {'sec-fetch-site': 'same-site'}],
    ['GET', {origin: LOCAL_ORIGIN, host: '127.0.0.1:5173'}],
    ['GET', {origin: LOCAL_ORIGIN, host: 'evil.example:5173'}],
  ] as const)('rejects %s %j before it can reach the upstream', async (method, headers) => {
    const previous = received.mock.calls.length;
    const response = await send(method, headers);
    expect(response.status).toBe(403);
    expect(received).toHaveBeenCalledTimes(previous);
  });

  it('allows same-origin reads without inventing an absent Origin', async () => {
    const response = await send('GET', {'sec-fetch-site': 'same-origin'}, '/api/auth/session');
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body).origin).toBeNull();
  });

  it('does not fabricate a missing CSRF token', async () => {
    await send('POST', {origin: LOCAL_ORIGIN});
    expect(received.mock.lastCall![0]['x-csrf-token']).toBeUndefined();
  });
});
