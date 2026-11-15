import type {IncomingMessage} from 'node:http';
import type {ConfigEnv, Plugin, ProxyOptions, UserConfig} from 'vite';

export const LOCAL_ORIGIN = 'http://localhost:5173';
export const PRODUCTION_ORIGIN = 'https://graphql.rebyte.fun';
const API_PATH = '^/api(?:/|\\?|$)';
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function localRequest(req: IncomingMessage): boolean {
  return req.headers.host === 'localhost:5173' && loopback.has(req.socket.remoteAddress ?? '');
}

function trustedOrigin(req: IncomingMessage): boolean {
  return localRequest(req) && req.headers.origin === LOCAL_ORIGIN &&
    (req.headers['sec-fetch-site'] === undefined || req.headers['sec-fetch-site'] === 'same-origin');
}

function allowedRequest(req: IncomingMessage): boolean {
  if (trustedOrigin(req)) return true;
  // Browsers can omit Origin on same-origin reads; never invent it for writes.
  return localRequest(req) && req.headers.origin === undefined &&
    safeMethods.has(req.method ?? '') &&
    (req.headers['sec-fetch-site'] === undefined || req.headers['sec-fetch-site'] === 'same-origin' ||
      req.headers['sec-fetch-site'] === 'none');
}

function productionAuthGuard(): Plugin {
  return {
    name: 'coverage-local-production-auth',
    apply: 'serve',
    configResolved(config) {
      const {host, port, strictPort, cors, https, middlewareMode} = config.server;
      if (config.base !== '/' || host !== 'localhost' || port !== 5173 || !strictPort || cors !== false || https || middlewareMode) {
        throw new Error('Production auth proxy requires http://localhost:5173, strictPort, CORS disabled and a standalone local dev server.');
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!new RegExp(API_PATH).test(req.url ?? '') || allowedRequest(req)) return next();
        res.writeHead(403, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
        res.end(JSON.stringify({detail: 'Local production auth proxy rejected this request'}));
      });
    },
  };
}

export function developmentApiConfig(
  {command, mode, isPreview}: ConfigEnv,
  env: Record<string, string | undefined>,
): Pick<UserConfig, 'plugins' | 'server' | 'preview'> {
  // Preview inherits server.proxy unless explicitly overridden. Neither it nor
  // a build (even --mode development) may install the privileged proxy.
  if (command !== 'serve' || isPreview) return {preview: {proxy: {}}};

  const productionAuth = env.COVERAGE_DEV_PROXY_PRODUCTION_AUTH === 'true';
  const target = env.COVERAGE_API_PROXY_TARGET || PRODUCTION_ORIGIN;
  if (productionAuth && (mode !== 'development' || ![PRODUCTION_ORIGIN, `${PRODUCTION_ORIGIN}/`].includes(target))) {
    throw new Error('Production auth proxy requires development mode and target https://graphql.rebyte.fun.');
  }

  const proxy: ProxyOptions = {target, changeOrigin: true, secure: true, ws: false, followRedirects: false};
  if (productionAuth) {
    proxy.configure = instance => {
      instance.on('proxyReq', (proxyReq, req) => {
        if (trustedOrigin(req)) proxyReq.setHeader('Origin', PRODUCTION_ORIGIN);
      });
    };
  }

  return {
    plugins: productionAuth ? [productionAuthGuard()] : [],
    server: {
      host: 'localhost', port: 5173, strictPort: true,
      ...(productionAuth ? {cors: false} : {}),
      proxy: {[API_PATH]: proxy},
    },
    preview: {proxy: {}},
  };
}
