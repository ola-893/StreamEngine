import { Request, Response, NextFunction } from 'express';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { ratePerSecondToMist } from '../registry/providers.ts';
import { updateProviderEarnings, getProviderByEndpoint } from '../db.ts';
import { readStreamObjectState } from './streams.ts';

const SUI_RPC_URL = process.env.SUI_RPC_URL || 'https://fullnode.testnet.sui.io:443';
export const PACKAGE_ID = process.env.SUI_DATA_GATE_PACKAGE_ID || '0xb05b3964df8b88a86cda6b192893399966014af9dd6fc6beb26f1343a0495495';
const client = new SuiJsonRpcClient({ url: SUI_RPC_URL, network: 'testnet' });

interface StreamEngineRequest extends Request {
  streamEngineAuth?: {
    streamId: string;
    agentAddress?: string;
    balance: string;
    providerId?: string;
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatSuiRate(rateMist: number): string {
  return (rateMist / 1_000_000_000).toFixed(9).replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * Express middleware that enforces x402 Payment Required for AI agent access.
 * 
 * Checks for a valid StreamObject on Sui testnet via RPC read (no consensus contention).
 * If the stream has a positive balance, the request is allowed through.
 * If no valid payment proof exists, returns HTTP 402 with payment requirements.
 */
export async function requireX402Payment(req: Request, res: Response, next: NextFunction) {
  // Support both header naming conventions
  const streamId = (req.headers['x-streamengine-stream-id'] || req.headers['x-flowpay-stream-id']) as string;
  const txDigest = (req.headers['x-streamengine-tx-digest'] || req.headers['x-flowpay-tx-digest']) as string;
  const provider = getProviderByEndpoint(req.path);
  const ratePerSecondMist = ratePerSecondToMist(provider?.ratePerSecond ?? process.env.STREAM_RATE_MIST ?? process.env.STREAM_RATE ?? '100');

  if (streamId) {
      // Validate the stream object via RPC (no consensus contention — fast read)
      try {
          const stream = await readStreamObjectState(streamId);
          if (stream.balanceMist > 0n) {
              const earnedMist = stream.ratePerSecondMist ?? ratePerSecondMist;
              if (provider) updateProviderEarnings(provider.id, earnedMist);

              console.log(`[Middleware] ✅ Valid stream ${streamId} found with balance: ${stream.balanceMist}`);
              (req as StreamEngineRequest).streamEngineAuth = {
                  streamId,
                  agentAddress: stream.sender,
                  balance: stream.balanceMist.toString(),
                  providerId: provider?.id,
              };
              return next();
          } else {
              console.log(`[Middleware] ❌ Stream ${streamId} balance is 0 — access revoked.`);
          }
      } catch (error: unknown) {
          console.error(`[Middleware] Error querying stream ${streamId}:`, errorMessage(error));
      }
  } else if (txDigest) {
      // Fast-Path: verify a direct payment transaction
      try {
          const tx = await client.getTransactionBlock({
              digest: txDigest,
              options: { showEffects: true, showInput: true }
          });
          if (tx.effects?.status.status === 'success') {
              if (provider) updateProviderEarnings(provider.id, ratePerSecondMist);
              console.log(`[Middleware] ✅ Valid Fast-Path payment found: ${txDigest}`);
              return next();
          }
      } catch (error: unknown) {
          console.error(`[Middleware] Error verifying tx ${txDigest}:`, errorMessage(error));
      }
  }

  // No valid payment — return 402 Payment Required
  const merchantAddress = provider?.providerAddress || process.env.MERCHANT_SUI_ADDRESS || '0x0000000000000000000000000000000000000000000000000000000000001234';
  const ratePerSecond = formatSuiRate(ratePerSecondMist);
  
  res.set('X-StreamEngine-Mode', 'streaming');
  res.set('X-StreamEngine-Rate', ratePerSecond);
  res.set('X-StreamEngine-Recipient', merchantAddress);

  res.status(402).json({
    error: 'Payment Required',
    x402: {
      provider: merchantAddress,
      providerId: provider?.id,
      ratePerSecond,
      ratePerSecondMist,
      minimumDeposit: String(ratePerSecondMist * 3600),
      packageId: PACKAGE_ID,
      instructions: 'Call create_stream() with this provider as recipient'
    }
  });
}
