/**
 * Node.js 24+ replaces the global `fetch` with an undici implementation that
 * intermittently fails to connect to external HTTPS endpoints (times out with
 * UND_ERR_CONNECT_TIMEOUT while the built-in `node:https` module works fine).
 *
 * This file unconditionally patches `globalThis.fetch` with a minimal
 * implementation backed by `node:https` so the Sui SDK (and anything else
 * calling fetch) works reliably.
 *
 * Import this module BEFORE any other imports that call `fetch`.
 */
import https from 'node:https';
import http from 'node:http';

function httpsFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const method = init?.method?.toUpperCase() || 'GET';

    // Collect headers
    const headers: Record<string, string> = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => { headers[k] = v; });
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([k, v]) => { headers[k] = v; });
      } else {
        Object.assign(headers, init.headers);
      }
    }

    // Handle body — read ReadableStream to string if needed
    const writeBody = (bodyStr: string | undefined) => {
      const isHttps = parsedUrl.protocol === 'https:';
    const reqOptions: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers,
        timeout: 30000,
      };

      const req = (isHttps ? https : http).request(reqOptions, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString('utf-8');
          const resHeaders = new Headers();
          if (res.headers) {
            for (const [key, value] of Object.entries(res.headers)) {
              if (value !== undefined) {
                resHeaders.set(key, Array.isArray(value) ? value.join(', ') : value);
              }
            }
          }
          resolve(new Response(responseBody, {
            status: res.statusCode ?? 500,
            statusText: res.statusMessage ?? 'Unknown',
            headers: resHeaders,
          }));
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });

      if (bodyStr) req.write(bodyStr);
      req.end();
    };

    if (init?.body) {
      if (typeof init.body === 'string') {
        writeBody(init.body);
      } else if (init.body instanceof ReadableStream) {
        const reader = init.body.getReader();
        const chunks: Uint8Array[] = [];
        const pump = (): Promise<void> =>
          reader.read().then(({ done, value }) => {
            if (done) {
              writeBody(new TextDecoder().decode(Buffer.concat(chunks.map(c => Buffer.from(c)))));
              return;
            }
            chunks.push(value);
            return pump();
          });
        pump().catch(reject);
      } else {
        writeBody(String(init.body));
      }
    } else {
      writeBody(undefined);
    }
  });
}

// Unconditionally patch — undici fetch is unreliable on Node.js 24
globalThis.fetch = httpsFetch as typeof fetch;
console.log('[fetch-polyfill] Patched globalThis.fetch with node:https implementation');
