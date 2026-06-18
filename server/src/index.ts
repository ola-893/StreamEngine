import './fetch-polyfill.js'; // Must be first — patches globalThis.fetch for Node.js 24 undici bug
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { requireX402Payment } from './x402/middleware.ts';
import { saveAgent, getAgent, getAllAgents, deleteAgent as dbDeleteAgent, saveProvider, getProvider, getAllProviders, updateProviderEarnings } from './db.ts';
import { readStreamObjectState, client as suiClient } from './x402/streams.ts';
import crypto from 'crypto';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { PACKAGE_ID } from './x402/middleware.ts';

// Use a real secret in production. For the hackathon demo, this is fine.
const ENCRYPTION_SECRET = (process.env.AGENT_WALLET_ENCRYPTION_KEY || 'streamengine-hackathon-secret!!').padEnd(32).slice(0, 32);

function generateAgentWallet(): { address: string; privateKeyBech32: string } {
  const keypair = new Ed25519Keypair();
  return {
    address: keypair.getPublicKey().toSuiAddress(),
    privateKeyBech32: keypair.getSecretKey(), // returns bech32 string like suiprivkey1q...
  };
}

function encryptPrivateKey(privateKeyBech32: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_SECRET), iv);
  let encrypted = cipher.update(privateKeyBech32, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptPrivateKey(encryptedData: string): string {
  const [ivHex, encryptedHex] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_SECRET), iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function getKeypairForAgent(agent: Agent): Ed25519Keypair {
  const privateKeyBech32 = decryptPrivateKey(agent.encryptedPrivateKey);
  const { secretKey } = decodeSuiPrivateKey(privateKeyBech32);
  return Ed25519Keypair.fromSecretKey(secretKey);
}

// ============================================================
//  PROCESS SAFETY — Prevent crashes from unhandled errors
// ============================================================
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught exception:', error);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
});

const MINIMUM_STREAM_SECONDS = 3600;
const PORT = parseInt(process.env.PORT || '3001');
const app = express();

app.use(cors());
app.use(express.json());

interface AgentStream {
  streamId: string;
  endpoint: string;
  ratePerSecondMist: number;
  openedAt: string;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  purpose: 'research' | 'trading' | 'monitoring' | 'content' | 'custom';
  budgetMist: number;
  spentMist: number;
  walletAddress: string;
  encryptedPrivateKey: string;
  activeStreams: AgentStream[];
  createdAt: string;
}

// ============================================================
//  AGENTS API
// ============================================================

app.post('/api/agents', (req, res) => {
  const { name, description, purpose, budgetMist } = req.body;
  if (!name || !purpose || budgetMist === undefined) {
    return res.status(400).json({ error: 'Missing required fields: name, purpose, budgetMist' });
  }

  const { address, privateKeyBech32 } = generateAgentWallet();
  const encryptedPrivateKey = encryptPrivateKey(privateKeyBech32);

  const newAgent: Agent = {
    id: `agent-${Date.now()}`,
    name,
    description: description || '',
    purpose,
    budgetMist: Number(budgetMist),
    spentMist: 0,
    walletAddress: address,
    encryptedPrivateKey,
    activeStreams: [],
    createdAt: new Date().toISOString()
  };
  
  saveAgent(newAgent);
  
  const { encryptedPrivateKey: _, ...agentWithoutSecret } = newAgent;
  res.status(201).json(agentWithoutSecret);
});

app.get('/api/agents', (req, res) => {
  res.json(getAllAgents());
});

app.delete('/api/agents/:id', (req, res) => {
  try {
    const agent = getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const deleted = dbDeleteAgent(req.params.id);
    if (deleted) {
      console.log(`[agents] Deleted agent "${agent.name}" (${agent.id})`);
      return res.json({ deleted: true, agentId: agent.id });
    }
    return res.status(500).json({ error: 'Failed to delete agent' });
  } catch (error: any) {
    console.error('[agents/:id DELETE] Error:', error?.message || error);
    res.status(500).json({ error: 'Delete failed', message: error?.message || String(error) });
  }
});

app.get('/api/agents/:id', async (req, res) => {
  try {
    const agent = getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    
    const { encryptedPrivateKey: _, ...agentWithoutSecret } = agent;
    res.json(agentWithoutSecret);
  } catch (error: any) {
    console.error('[agents/:id] Error:', error?.message || error);
    res.status(500).json({ error: 'Internal server error', message: error?.message || String(error) });
  }
});

app.get('/api/agents/:id/balance', async (req, res) => {
  try {
    const agent = getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const coins = await suiClient.getCoins({
      owner: agent.walletAddress,
      coinType: '0x2::sui::SUI',
    });

    const totalBalance = coins.data.reduce(
      (sum, coin) => sum + parseInt(coin.balance),
      0
    );

    return res.json({
      agentId: agent.id,
      walletAddress: agent.walletAddress,
      balanceMist: totalBalance,
      balanceSui: totalBalance / 1_000_000_000,
    });
  } catch (error: any) {
    console.error('[agents/:id/balance] Error:', error?.message || error);
    res.status(500).json({ error: 'Failed to fetch balance', message: error?.message || String(error) });
  }
});

app.post('/api/agents/:id/access', async (req, res) => {
  try {
    const agent = getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' });

    console.log(`[access] Agent "${agent.name}" (${agent.id}) requesting access to ${endpoint}`);

    const providerRegistry = getAllProviders();
    const provider = providerRegistry.find(p => p.endpoint === endpoint);
    if (!provider) {
      console.error(`[access] Provider not found for endpoint ${endpoint}`);
      return res.status(404).json({ error: 'Provider not found for endpoint' });
    }
    console.log(`[access] Matched provider: ${provider.name} (${provider.id}) — rate: ${provider.ratePerSecond} MIST/sec`);

    const coins = await suiClient.getCoins({ owner: agent.walletAddress, coinType: '0x2::sui::SUI' });
    const balance = coins.data.reduce((sum, c) => sum + parseInt(c.balance), 0);
    const minimumRequired = provider.ratePerSecond * MINIMUM_STREAM_SECONDS;
    console.log(`[access] Agent wallet balance: ${balance} MIST (${balance / 1_000_000_000} SUI), minimum required: ${minimumRequired} MIST (${minimumRequired / 1_000_000_000} SUI)`);

    if (balance < minimumRequired) {
      console.error(`[access] Insufficient balance for agent ${agent.id}`);
      return res.status(402).json({
        error: 'Insufficient agent wallet balance',
        walletAddress: agent.walletAddress,
        balanceMist: balance,
        requiredMist: minimumRequired,
        message: `Fund the agent wallet with at least ${minimumRequired / 1_000_000_000} SUI`,
      });
    }

    const keypair = getKeypairForAgent(agent);
    const { Transaction } = await import('@mysten/sui/transactions');
    const tx = new Transaction();

    const depositAmount = provider.ratePerSecond * MINIMUM_STREAM_SECONDS;
    const [depositCoin] = tx.splitCoins(tx.gas, [depositAmount]);
    console.log(`[access] Creating stream — deposit: ${depositAmount} MIST (${depositAmount / 1_000_000_000} SUI)`);

    tx.moveCall({
      target: `${PACKAGE_ID}::stream::create_stream`,
      arguments: [
        depositCoin,
        tx.pure.address(provider.providerAddress),
        tx.pure.u64(provider.ratePerSecond),
        tx.pure.vector('u8', new TextEncoder().encode(JSON.stringify({ agentId: agent.id }))),
        tx.object('0x6'),
      ],
      typeArguments: ['0x2::sui::SUI'],
    });

    console.log(`[access] Signing and executing transaction...`);
    const result = await suiClient.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
      options: { showEffects: true, showEvents: true }
    });
    console.log(`[access] Transaction executed — digest: ${result.digest}`);

    const streamObjectId = result.effects?.created?.[0]?.reference?.objectId;
    if (!streamObjectId) {
      console.error(`[access] Stream creation failed — no object ID in transaction effects`);
      return res.status(500).json({ error: 'Stream creation failed — no object ID in result' });
    }
    console.log(`[access] Stream created — streamId: ${streamObjectId}`);

    agent.activeStreams.push({
      streamId: streamObjectId,
      endpoint: endpoint,
      ratePerSecondMist: provider.ratePerSecond,
      openedAt: new Date().toISOString(),
    });
    agent.spentMist += depositAmount;
    saveAgent(agent);
    console.log(`[access] Agent state updated — activeStreams: ${agent.activeStreams.length}, spentMist: ${agent.spentMist}`);

    console.log(`[access] Fetching data from ${endpoint}...`);
    const dataResponse = await fetch(`http://localhost:${PORT}${endpoint}`, {
      headers: { 'x-streamengine-stream-id': streamObjectId },
    });
    const data = await dataResponse.json();
    console.log(`[access] Data fetched successfully from ${endpoint}`);

    return res.json({
      streamId: streamObjectId,
      creationTx: result.digest,
      depositMist: depositAmount,
      data,
    });
  } catch (error: any) {
    console.error('[agents/:id/access] Error:', error?.message || error);
    res.status(500).json({ error: 'Access failed', message: error?.message || String(error) });
  }
});

app.get('/api/agents/:id/streams', async (req, res) => {
  try {
    const agent = getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const streamsWithBalance = await Promise.all(
      agent.activeStreams.map(async (stream: AgentStream) => {
        try {
          const obj = await suiClient.getObject({
            id: stream.streamId,
            options: { showContent: true },
          });
          const fields = (obj.data?.content as any)?.fields;
          const balanceMist = parseInt(fields?.balance?.fields?.value ?? '0');
          return { ...stream, balanceMist, balanceSui: balanceMist / 1_000_000_000 };
        } catch {
          return { ...stream, balanceMist: 0, balanceSui: 0, error: 'Could not read on-chain balance' };
        }
      })
    );

    return res.json({ agentId: agent.id, streams: streamsWithBalance });
  } catch (error: any) {
    console.error('[agents/:id/streams] Error:', error?.message || error);
    res.status(500).json({ error: 'Failed to list streams', message: error?.message || String(error) });
  }
});

app.delete('/api/agents/:id/streams/:streamId', async (req, res) => {
  try {
    const agent = getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const { streamId } = req.params;
    const streamRecord = agent.activeStreams.find((s: AgentStream) => s.streamId === streamId);
    if (!streamRecord) return res.status(404).json({ error: 'Stream not found on agent' });

    const keypair = getKeypairForAgent(agent);
    const { Transaction } = await import('@mysten/sui/transactions');
    const tx = new Transaction();

    tx.moveCall({
      target: `${PACKAGE_ID}::stream::close_stream`,
      arguments: [
        tx.object(streamId),
        tx.object('0x6'),
      ],
      typeArguments: ['0x2::sui::SUI'],
    });

    const result = await suiClient.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
    });

    agent.activeStreams = agent.activeStreams.filter((s: AgentStream) => s.streamId !== streamId);
    saveAgent(agent);

    return res.json({ closed: true, streamId, refundTx: result.digest });
  } catch (error: any) {
    console.error('[agents/:id/streams/:streamId] Error:', error?.message || error);
    res.status(500).json({ error: 'Failed to close stream', message: error?.message || String(error) });
  }
});

app.post('/api/agents/:id/start', async (req, res) => {
  try {
    const agent = getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    console.log(`[start] ▶ Starting agent "${agent.name}" (${agent.id}) — purpose: ${agent.purpose}`);

    const providers = getAllProviders();
    console.log(`[start] Found ${providers.length} registered providers`);

    // All agent purposes can access all provider categories
    const purposeToCategory: Record<string, string[]> = {
      research: ['Research', 'News', 'General', 'Finance', 'Social Media'],
      trading: ['Finance', 'Social Media', 'Research', 'News', 'General'],
      monitoring: ['Social Media', 'Finance', 'Research', 'News', 'General'],
      content: ['Social Media', 'Finance', 'Research', 'News', 'General'],
      custom: ['Social Media', 'Finance', 'Research', 'News', 'General'],
    };
    const relevantCategories = purposeToCategory[agent.purpose] || [];
    console.log(`[start] Relevant categories for "${agent.purpose}": [${relevantCategories.join(', ')}]`);

    const matchedProviders = providers.filter(p =>
      relevantCategories.some(cat => p.category?.toLowerCase() === cat.toLowerCase())
    );
    console.log(`[start] Matched ${matchedProviders.length} providers: ${matchedProviders.map(p => p.name).join(', ') || 'none'}`);

    if (matchedProviders.length === 0) {
      console.log(`[start] ✗ No matching providers found for agent "${agent.name}"`);
      return res.json({ message: 'No matching providers found for agent purpose', started: false });
    }

    const coins = await suiClient.getCoins({ owner: agent.walletAddress, coinType: '0x2::sui::SUI' });
    const balance = coins.data.reduce((sum, c) => sum + parseInt(c.balance), 0);
    console.log(`[start] Agent wallet balance: ${balance} MIST (${balance / 1_000_000_000} SUI)`);

    if (balance === 0) {
      console.log(`[start] ✗ Agent wallet is empty — cannot start`);
      return res.status(402).json({
        error: 'Agent wallet is empty',
        walletAddress: agent.walletAddress,
        message: 'Fund the agent wallet before starting autonomous mode',
      });
    }

    const affordable = matchedProviders.find(p => balance >= p.ratePerSecond * MINIMUM_STREAM_SECONDS);
    if (!affordable) {
      console.log(`[start] ✗ Insufficient balance for any matched provider (need ≥${MINIMUM_STREAM_SECONDS}s of streaming)`);
      return res.status(402).json({ error: 'Insufficient balance for any matched provider', message: `Fund the agent wallet with at least ${Math.ceil((matchedProviders[0]?.ratePerSecond || 100) * MINIMUM_STREAM_SECONDS / 1_000_000_000)} SUI to start` });
    }
    console.log(`[start] Selected provider: ${affordable.name} (${affordable.ratePerSecond} MIST/sec)`);
    console.log(`[start] Opening stream to ${affordable.endpoint}...`);

    const accessRes = await fetch(`http://localhost:${PORT}/api/agents/${agent.id}/access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: affordable.endpoint }),
    });
    const accessData = await accessRes.json();

    if (accessData.streamId) {
      console.log(`[start] ✓ Agent "${agent.name}" started successfully`);
      console.log(`[start]   provider: ${affordable.name}`);
      console.log(`[start]   streamId: ${accessData.streamId}`);
      console.log(`[start]   tx: ${accessData.creationTx}`);
      console.log(`[start]   deposit: ${accessData.depositMist} MIST (${accessData.depositMist / 1_000_000_000} SUI)`);
      return res.json({
        started: true,
        provider: affordable.name,
        ...accessData,
      });
    } else {
      console.error(`[start] ✗ Access failed: ${JSON.stringify(accessData)}`);
      return res.status(accessRes.status || 500).json({
        started: false,
        provider: affordable.name,
        error: accessData.error || 'Stream creation failed',
        message: accessData.message || 'Could not open a payment stream',
      });
    }
  } catch (error: any) {
    console.error('[agents/:id/start] Error:', error?.message || error);
    res.status(500).json({ error: 'Failed to start agent', message: error?.message || String(error) });
  }
});

// ============================================================
//  STREAM SESSION — Live streaming state + data fetch
// ============================================================

app.get('/api/agents/:id/streams/:streamId/state', async (req, res) => {
  try {
    const agent = getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const stream = agent.activeStreams.find((s: AgentStream) => s.streamId === req.params.streamId);
    if (!stream) return res.status(404).json({ error: 'Stream not found on agent' });

    // Read live on-chain balance
    let balanceMist = 0;
    try {
      const obj = await suiClient.getObject({
        id: stream.streamId,
        options: { showContent: true },
      });
      const fields = (obj.data?.content as any)?.fields;
      balanceMist = parseInt(fields?.balance?.fields?.value ?? '0');
    } catch {
      // fallback to 0
    }

    const elapsedMs = Date.now() - new Date(stream.openedAt).getTime();
    const elapsedSec = Math.floor(elapsedMs / 1000);
    const ratePerSec = stream.ratePerSecondMist / 1_000_000_000;
    const drainedMist = Math.min(elapsedSec * stream.ratePerSecondMist, stream.ratePerSecondMist * MINIMUM_STREAM_SECONDS - balanceMist);
    const remainingSec = ratePerSec > 0 ? Math.floor(balanceMist / stream.ratePerSecondMist) : 0;

    return res.json({
      streamId: stream.streamId,
      endpoint: stream.endpoint,
      openedAt: stream.openedAt,
      ratePerSecondMist: stream.ratePerSecondMist,
      rateSuiPerSec: ratePerSec,
      balanceMist,
      balanceSui: balanceMist / 1_000_000_000,
      elapsedSec,
      remainingSec,
      drainedMist,
      drainedSui: drainedMist / 1_000_000_000,
      status: balanceMist > 0 ? 'streaming' : 'depleted',
    });
  } catch (error: any) {
    console.error('[streams/:id/state] Error:', error?.message || error);
    res.status(500).json({ error: 'Failed to get stream state', message: error?.message || String(error) });
  }
});

app.post('/api/agents/:id/streams/:streamId/fetch-data', async (req, res) => {
  try {
    const agent = getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const stream = agent.activeStreams.find((s: AgentStream) => s.streamId === req.params.streamId);
    if (!stream) return res.status(404).json({ error: 'Stream not found on agent' });

    console.log(`[stream-session] Agent "${agent.name}" fetching data from ${stream.endpoint}`);

    const dataResponse = await fetch(`http://localhost:${PORT}${stream.endpoint}`, {
      headers: { 'x-streamengine-stream-id': stream.streamId },
    });
    const data = await dataResponse.json();
    console.log(`[stream-session] Data fetched from ${stream.endpoint} — ${(JSON.stringify(data).length / 1024).toFixed(1)}KB`);

    // Read current on-chain balance after fetch
    let balanceMist = 0;
    try {
      const obj = await suiClient.getObject({
        id: stream.streamId,
        options: { showContent: true },
      });
      const fields = (obj.data?.content as any)?.fields;
      balanceMist = parseInt(fields?.balance?.fields?.value ?? '0');
    } catch {}

    return res.json({
      data,
      balanceMist,
      balanceSui: balanceMist / 1_000_000_000,
      fetchedAt: new Date().toISOString(),
      sizeBytes: JSON.stringify(data).length,
    });
  } catch (error: any) {
    console.error('[stream-session/fetch-data] Error:', error?.message || error);
    res.status(500).json({ error: 'Data fetch failed', message: error?.message || String(error) });
  }
});

app.post('/api/agents/:id/fund-demo', async (req, res) => {
  try {
    const agent = getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    
    const { amountMist } = req.body;
    if (!amountMist) return res.status(400).json({ error: 'Missing amountMist' });

    // Use a test wallet to fund the agent
    const testPrivateKeyHex = process.env.SUI_PRIVATE_KEY || 'e6027c95a2858b99c7162985fde44cd8b898a39a671f657a731dfeddae11aeb2'; // 32-byte hex for a dummy wallet that has SUI
    const cleanHex = testPrivateKeyHex.startsWith('0x') ? testPrivateKeyHex.slice(2) : testPrivateKeyHex;
    const testWalletKeypair = Ed25519Keypair.fromSecretKey(Buffer.from(cleanHex, 'hex'));

    const { Transaction } = await import('@mysten/sui/transactions');
    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [amountMist]);
    tx.transferObjects([coin], tx.pure.address(agent.walletAddress));
    
    const result = await suiClient.signAndExecuteTransaction({ transaction: tx, signer: testWalletKeypair });
    await suiClient.waitForTransaction({ digest: result.digest });
    
    res.json({ success: true, digest: result.digest, fundedAmountMist: amountMist });
  } catch (error: any) {
    const msg = error?.message || String(error);
    console.error(`[fund-demo] Failed to fund agent:`, msg);
    if (msg.includes('Insufficient') || msg.includes('not enough') || msg.includes('Balance')) {
      res.status(402).json({ error: 'Insufficient test wallet balance', message: 'The demo test wallet has no SUI. Set SUI_PRIVATE_KEY env var to a funded wallet.' });
    } else {
      res.status(500).json({ error: 'Funding failed', message: msg });
    }
  }
});

// ============================================================
//  PUBLIC API — Marketplace Registry (no payment required)
// ============================================================

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** List all registered website listings */
function listProviders(req: express.Request, res: express.Response) {
  res.json({ providers: getAllProviders() });
}

/** Register a new website listing */
function createProvider(req: express.Request, res: express.Response) {
  const { providerAddress, name, websiteUrl, endpoint, ratePerSecond, description, category } = req.body;
  if (!providerAddress || !name || !websiteUrl || !ratePerSecond) {
    return res.status(400).json({ error: 'Missing required fields: providerAddress, name, websiteUrl, ratePerSecond' });
  }
  const listing = {
    id: 'provider-' + Math.random().toString(36).substring(2, 10),
    providerAddress,
    name,
    websiteUrl,
    endpoint: endpoint || `/api/premium/listed/${slugify(name)}/feed`,
    ratePerSecond: Number(ratePerSecond),
    description: description || '',
    category: category || 'General',
  };
  saveProvider(listing);
  res.status(201).json(listing);
}

app.get('/api/providers', listProviders);

app.get('/api/registry/providers', listProviders);

app.post('/api/providers', createProvider);

/** Get a specific provider */
app.get('/api/registry/providers/:id', (req, res) => {
  const provider = getProvider(req.params.id);
  if (!provider) return res.status(404).json({ error: 'Provider not found' });
  res.json(provider);
});

/** Register a new website listing */
app.post('/api/registry/providers', createProvider);

/** Read live StreamObject balance from Sui RPC */
app.get('/api/streams/:id/balance', async (req, res) => {
  try {
    const stream = await readStreamObjectState(req.params.id);
    const balanceMist = Number(stream.balanceMist);
    res.json({
      streamId: stream.streamId,
      balanceMist,
      balanceSui: balanceMist / 1_000_000_000,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(404).json({ error: 'Stream not found', message });
  }
});

/** Return provider earnings accumulated by successful access grants */
app.get('/api/providers/:id/earnings', (req, res) => {
  const provider = getProvider(req.params.id);
  if (!provider) return res.status(404).json({ error: 'Provider not found' });
  res.json({
    providerId: req.params.id,
    totalEarnedMist: provider.earningsMist || 0,
  });
});

/** Health check */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'FlowGate Gateway', providers: getAllProviders().length });
});

// ============================================================
//  PREMIUM ENDPOINTS — Protected by x402 Payment Required
// ============================================================

app.get('/api/premium/x-social/feed', requireX402Payment, (req, res) => {
  const auth = (req as any).streamEngineAuth;
  console.log(`[Gateway] Serving X scrape feed to agent ${auth?.agentAddress?.substring(0, 10) || 'unknown'}...`);
  res.json({
    provider: 'X (Twitter)',
    websiteUrl: 'https://x.com',
    endpoint: '/api/premium/x-social/feed',
    scrapedAt: new Date().toISOString(),
    data: [
      {
        author: '@sui_network',
        content: 'Programmable payment streams unlock a new access model for autonomous agents.',
        likes: 18420,
        timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
      },
      {
        author: '@agentops',
        content: 'Scraping budgets should be negotiated in real time, not settled in monthly invoices.',
        likes: 9312,
        timestamp: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
      },
      {
        author: '@webmonetize',
        content: 'Site owners need a native way to meter AI crawler access without blocking useful agents.',
        likes: 5621,
        timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
      },
    ],
  });
});

app.get('/api/premium/reddit/feed', requireX402Payment, (req, res) => {
  const auth = (req as any).streamEngineAuth;
  console.log(`[Gateway] Serving Reddit scrape feed to agent ${auth?.agentAddress?.substring(0, 10) || 'unknown'}...`);
  res.json({
    provider: 'Reddit',
    websiteUrl: 'https://reddit.com',
    endpoint: '/api/premium/reddit/feed',
    scrapedAt: new Date().toISOString(),
    data: [
      {
        subreddit: 'r/MachineLearning',
        title: 'Payment streams for crawler access: what would fair pricing look like?',
        upvotes: 4217,
        top_comment: 'The interesting part is revocation. A dead stream should mean no more access.',
        url: 'https://reddit.com/r/MachineLearning/comments/streamengine',
      },
      {
        subreddit: 'r/Sui',
        title: 'Shared objects make per-second web access controls surprisingly practical',
        upvotes: 1288,
        top_comment: 'This is the first x402-style demo I have seen with real Sui objects.',
        url: 'https://reddit.com/r/Sui/comments/shared_streams',
      },
      {
        subreddit: 'r/webscraping',
        title: 'Would you pay per second for premium site scraping access?',
        upvotes: 953,
        top_comment: 'If it avoids brittle proxy games and has clear limits, yes.',
        url: 'https://reddit.com/r/webscraping/comments/pay_per_second',
      },
    ],
  });
});

app.get('/api/premium/bloomberg/feed', requireX402Payment, (req, res) => {
  const auth = (req as any).streamEngineAuth;
  console.log(`[Gateway] Serving Bloomberg scrape feed to agent ${auth?.agentAddress?.substring(0, 10) || 'unknown'}...`);
  res.json({
    provider: 'Bloomberg',
    websiteUrl: 'https://bloomberg.com',
    endpoint: '/api/premium/bloomberg/feed',
    scrapedAt: new Date().toISOString(),
    data: [
      {
        headline: 'AI infrastructure spending lifts cloud guidance across megacap earnings',
        summary: 'Executives pointed to sustained demand from autonomous agents and data-heavy model workflows.',
        ticker: 'MSFT',
        published_at: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
      },
      {
        headline: 'Treasury yields edge lower as traders price a slower policy path',
        summary: 'Bond desks cited softer labor data and lower inflation breakevens in early New York trading.',
        ticker: 'US10Y',
        published_at: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
      },
      {
        headline: 'Semiconductor suppliers rally on stronger-than-expected order backlog',
        summary: 'Analysts said inference workloads are broadening demand beyond flagship GPU vendors.',
        ticker: 'NVDA',
        published_at: new Date(Date.now() - 37 * 60 * 1000).toISOString(),
      },
    ],
  });
});

// ============================================================
//  START
// ============================================================

app.listen(PORT, () => {
  const existingProviders = getAllProviders();
  if (existingProviders.length === 0) {
    const DEMO_PROVIDER_ADDRESS = '0x0000000000000000000000000000000000000000000000000000000000001234';
    saveProvider({
        id: 'x-social',
        providerAddress: DEMO_PROVIDER_ADDRESS,
        name: 'X (Twitter)',
        description: 'Real-time posts, trending topics, and human interactions from X.com',
        websiteUrl: 'https://x.com',
        endpoint: '/api/premium/x-social/feed',
        ratePerSecond: 100,
        category: 'Social Media'
    });
    saveProvider({
        id: 'reddit',
        providerAddress: DEMO_PROVIDER_ADDRESS,
        name: 'Reddit',
        description: 'Upvoted threads, community discussions, and niche subreddit data',
        websiteUrl: 'https://reddit.com',
        endpoint: '/api/premium/reddit/feed',
        ratePerSecond: 80,
        category: 'Social Media'
    });
    saveProvider({
        id: 'bloomberg',
        providerAddress: DEMO_PROVIDER_ADDRESS,
        name: 'Bloomberg',
        description: 'Proprietary financial news, earnings call transcripts, and market commentary',
        websiteUrl: 'https://bloomberg.com',
        endpoint: '/api/premium/bloomberg/feed',
        ratePerSecond: 200,
        category: 'Finance'
    });
  }

  const providers = getAllProviders();
  console.log(`\n🚀 FlowGate Gateway listening on http://localhost:${PORT}`);
  console.log(`\n📋 Registry: ${providers.length} websites listed`);
  providers.forEach(p => {
    console.log(`   → ${p.name} | ${p.ratePerSecond} MIST/sec | GET ${p.endpoint}`);
  });
  console.log(`\n🔒 All premium endpoints return 402 Payment Required without a valid stream.`);
  console.log(`📖 Browse listed websites: GET /api/providers\n`);
});
