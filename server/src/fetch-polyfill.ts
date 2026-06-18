/**
 * Node.js 24.14.1 on macOS has a fundamental networking bug where ALL outbound
 * HTTPS connections via `node:https`, `globalThis.fetch`, and `undici` time
 * out with UND_ERR_CONNECT_TIMEOUT / ECONNRESET.
 *
 * Additionally, the Sui testnet RPC node at fullnode.testnet.sui.io is
 * intermittently unreachable — some connections succeed instantly while
 * others time out after 30s.
 *
 * This module replaces `globalThis.fetch` with a curl-backed implementation
 * with retry logic, so that ALL fetch calls — including those made internally
 * by the Sui SDK during signAndExecuteTransaction — work reliably.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function curlFetchOnce(url: string, method: string, headerArgs: string[], body?: string): Promise<Response> {
  const args = [
    '--silent',
    '--show-error',
    '--connect-timeout', '15',
    '--max-time', '30',
    '--write-out', '\n__HTTP_STATUS__%{http_code}',
    '--request', method,
    ...headerArgs,
  ];

  if (process.env.SUI_RPC_FORCE_IPV4 === 'true') {
    args.splice(6, 0, '--ipv4');
  }

  if (body) {
    args.push('--data', body);
  }

  args.push(url);

  const { stdout } = await execFileAsync('curl', args, { maxBuffer: 10 * 1024 * 1024 });

  // Parse: body followed by newline + "__HTTP_STATUS__" + status code
  const marker = '\n__HTTP_STATUS__';
  const markerIdx = stdout.lastIndexOf(marker);
  const bodyStr = markerIdx >= 0 ? stdout.substring(0, markerIdx) : stdout;
  const statusCode = markerIdx >= 0
    ? parseInt(stdout.substring(markerIdx + marker.length), 10)
    : 200;

  const resHeaders = new Headers();
  resHeaders.set('content-type', 'application/json');

  return new Response(bodyStr, {
    status: isNaN(statusCode) ? 200 : statusCode,
    statusText: 'OK',
    headers: resHeaders,
  });
}

function curlFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

  const method = init?.method?.toUpperCase() || 'GET';

  // Collect headers
  const headerArgs: string[] = [];
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((v, k) => { headerArgs.push('-H', `${k}: ${v}`); });
    } else if (Array.isArray(init.headers)) {
      init.headers.forEach(([k, v]) => { headerArgs.push('-H', `${k}: ${v}`); });
    } else {
      for (const [k, v] of Object.entries(init.headers)) {
        if (v !== undefined) headerArgs.push('-H', `${k}: ${v}`);
      }
    }
  }

  // Handle body
  let body: string | undefined;
  if (init?.body) {
    if (typeof init.body === 'string') {
      body = init.body;
    } else {
      body = String(init.body);
    }
  }

  // Retry loop with exponential backoff
  return (async () => {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await curlFetchOnce(url, method, headerArgs, body);
      } catch (error: any) {
        lastError = error;
        const isRetryable = error.message?.includes('timed out') ||
          error.message?.includes('Timeout') ||
          error.message?.includes('ECONNRESET') ||
          error.message?.includes('connect_timeout') ||
          error.message?.includes('connect error');

        if (isRetryable && attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * attempt;
          console.warn(`[fetch-polyfill] Attempt ${attempt}/${MAX_RETRIES} failed for ${url}: ${error.message}. Retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        throw error;
      }
    }
    throw lastError || new TypeError('fetch failed after retries');
  })();
}

// Replace globalThis.fetch with our curl-backed implementation
globalThis.fetch = curlFetch as typeof fetch;

console.log('[fetch-polyfill] Patched globalThis.fetch with curl-backed implementation + retry (Node.js 24 workaround)');
