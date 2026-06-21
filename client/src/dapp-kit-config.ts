import { createDAppKit } from '@mysten/dapp-kit-core';
import { BaseClient } from '@mysten/sui/client';

// BaseClient is marked abstract in the type definitions but is concrete at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SuiClient = BaseClient as any;

export const dAppKit = createDAppKit({
  networks: ['testnet', 'mainnet'] as const,
  defaultNetwork: 'testnet',
  createClient: (network) => {
    const client = new SuiClient({
      url:
        network === 'testnet'
          ? 'https://fullnode.testnet.sui.io:443'
          : 'https://fullnode.mainnet.sui.io:443',
    });
    // dAppKit resolves the chain via client.network — must be set for signAndExecuteTransaction
    (client as any).network = network;
    return client;
  },
  enableBurnerWallet: true,
});
