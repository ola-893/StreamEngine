/**
 * Custom HTTP transport for the Sui JSON-RPC client.
 *
 * Node.js 24.14.1 has a fundamental networking bug on macOS where outbound
 * HTTPS connections via `node:https`, `globalThis.fetch`, and `undici` all
 * time out with UND_ERR_CONNECT_TIMEOUT or ECONNRESET. Meanwhile `curl`
 * (which uses Apple's Network.framework / LibreSSL) connects fine.
 *
 * This transport shells out to `curl` for each RPC request, which is the
 * only reliable way to reach external HTTPS servers from Node.js 24.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { JsonRpcTransport, JsonRpcTransportRequestOptions } from '@mysten/sui/jsonRpc';

const execFileAsync = promisify(execFile);

interface CurlTransportOptions {
  forceIpv4?: boolean;
  maxAttempts?: number;
}

export class CurlTransport implements JsonRpcTransport {
  #urls: string[];
  #forceIpv4: boolean;
  #maxAttempts: number;
  #activeUrlIndex = 0;

  constructor(urls: string | string[], options: CurlTransportOptions = {}) {
    this.#urls = Array.isArray(urls) ? urls : [urls];
    this.#forceIpv4 = options.forceIpv4 ?? process.env.SUI_RPC_FORCE_IPV4 === 'true';
    this.#maxAttempts = options.maxAttempts ?? 2;
  }

  async request<T = unknown>(input: JsonRpcTransportRequestOptions): Promise<T> {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: input.method,
      params: input.params,
    });

    const errors: string[] = [];

    for (let attempt = 1; attempt <= this.#maxAttempts; attempt++) {
      for (let offset = 0; offset < this.#urls.length; offset++) {
        const urlIndex = (this.#activeUrlIndex + offset) % this.#urls.length;
        const url = this.#urls[urlIndex];
        try {
          const stdout = await this.#requestOnce(url, input, body);
          const data = JSON.parse(stdout);

          if (data.error) {
            throw new Error(`RPC Error ${data.error.code}: ${data.error.message}`);
          }

          if (attempt > 1 || urlIndex !== this.#activeUrlIndex) {
            console.warn(`[sui-rpc] ${input.method} recovered via ${url}`);
          }
          this.#activeUrlIndex = urlIndex;

          return data.result as T;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`${url}: ${message}`);
          console.warn(`[sui-rpc] ${input.method} failed on ${url} (attempt ${attempt}/${this.#maxAttempts}): ${message}`);
        }
      }
    }

    throw new Error(`All Sui RPC endpoints failed for ${input.method}: ${errors.join(' | ')}`);
  }

  async #requestOnce(url: string, input: JsonRpcTransportRequestOptions, body: string): Promise<string> {
    const args = [
      '--silent',
      '--show-error',
      '--connect-timeout', process.env.SUI_RPC_CONNECT_TIMEOUT_SECONDS || '10',
      '--max-time', process.env.SUI_RPC_MAX_TIME_SECONDS || '25',
      '--header', 'Content-Type: application/json',
      '--header', 'Client-Sdk-Type: typescript',
      '--header', `Client-Request-Method: ${input.method}`,
      '--data', body,
      url,
    ];

    if (this.#forceIpv4) {
      args.splice(6, 0, '--ipv4');
    }

    const { stdout } = await execFileAsync('curl', args, {
      maxBuffer: 10 * 1024 * 1024,
      signal: input.signal,
    });

    return stdout;
  }
}
