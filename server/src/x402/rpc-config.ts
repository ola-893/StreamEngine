export const SUI_NETWORK = process.env.SUI_NETWORK || 'testnet';

const DEFAULT_RPC_URLS_BY_NETWORK: Record<string, string[]> = {
  testnet: [
    'https://fullnode.testnet.sui.io:443',
    'https://sui-testnet-rpc.publicnode.com',
  ],
  mainnet: [
    'https://fullnode.mainnet.sui.io:443',
    'https://sui-rpc.publicnode.com',
  ],
  devnet: [
    'https://fullnode.devnet.sui.io:443',
    'https://sui-devnet-rpc.publicnode.com',
  ],
};

function splitUrls(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function getSuiRpcUrls(): string[] {
  const primaryUrls = splitUrls(process.env.SUI_RPC_URL);
  const fallbackUrls = splitUrls(process.env.SUI_RPC_FALLBACK_URLS);
  const defaultUrls = DEFAULT_RPC_URLS_BY_NETWORK[SUI_NETWORK] ?? DEFAULT_RPC_URLS_BY_NETWORK.testnet;

  return unique([
    ...(primaryUrls.length > 0 ? primaryUrls : defaultUrls),
    ...fallbackUrls,
  ]);
}
