import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { CurlTransport } from './curl-transport.ts';
import { getSuiRpcUrls, SUI_NETWORK } from './rpc-config.ts';

const SUI_RPC_URLS = getSuiRpcUrls();

export const client = new SuiJsonRpcClient({
  transport: new CurlTransport(SUI_RPC_URLS),
  network: SUI_NETWORK,
});

export interface StreamObjectState {
  streamId: string;
  balanceMist: bigint;
  ratePerSecondMist?: number;
  sender?: string;
  recipient?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toBigInt(value: unknown): bigint | undefined {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && value.length > 0) return BigInt(value);
  return undefined;
}

function stringField(fields: unknown, key: string): string | undefined {
  if (!isRecord(fields)) return undefined;
  const value = fields[key];
  return typeof value === 'string' ? value : undefined;
}

function numberField(fields: unknown, key: string): number | undefined {
  if (!isRecord(fields)) return undefined;
  const value = toBigInt(fields[key]);
  return value === undefined ? undefined : Number(value);
}

export function extractStreamBalanceMist(fields: unknown): bigint {
  if (!isRecord(fields)) return 0n;

  const balance = fields.balance;
  const directBalance = toBigInt(balance);
  if (directBalance !== undefined) return directBalance;

  if (!isRecord(balance)) return 0n;
  const balanceFields = balance.fields;
  if (!isRecord(balanceFields)) return 0n;

  return toBigInt(balanceFields.value) ?? 0n;
}

export async function readStreamObjectState(streamId: string): Promise<StreamObjectState> {
  const objectData = await client.getObject({
    id: streamId,
    options: { showContent: true },
  });

  const content = objectData.data?.content;
  if (!content || content.dataType !== 'moveObject') {
    throw new Error(`StreamObject not found or has no moveObject content: ${streamId}`);
  }

  const fields = content.fields;
  return {
    streamId,
    balanceMist: extractStreamBalanceMist(fields),
    ratePerSecondMist: numberField(fields, 'rate_per_second'),
    sender: stringField(fields, 'sender'),
    recipient: stringField(fields, 'recipient'),
  };
}
