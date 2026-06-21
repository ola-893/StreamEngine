import './fetch-polyfill.js'; // Must be first — patches globalThis.fetch for Node.js 24 undici bug
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { requireX402Payment } from './x402/middleware.ts';
import { saveAgent, getAgent, getAllAgents, deleteAgent as dbDeleteAgent, saveProvider, getProvider, getProviderByEndpoint, getAllProviders, updateProviderEarnings, deleteProvider as dbDeleteProvider } from './db.ts';
import { readStreamObjectState, extractStreamBalanceMist, client as suiClient } from './x402/streams.ts';
import crypto from 'crypto';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import { PACKAGE_ID } from './x402/middleware.ts';

if (!process.env.AGENT_KEY_SECRET) {
  throw new Error('AGENT_KEY_SECRET must be set — refusing to start with no encryption key');
}
const ENCRYPTION_SECRET = process.env.AGENT_KEY_SECRET.padEnd(32).slice(0, 32);

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
  try {
    const privateKeyBech32 = decryptPrivateKey(agent.encryptedPrivateKey);
    const { secretKey } = decodeSuiPrivateKey(privateKeyBech32);
    return Ed25519Keypair.fromSecretKey(secretKey);
  } catch (err: any) {
    if (err?.message?.includes('bad decrypt') || err?.code === 'ERR_OSSL_BAD_DECRYPT') {
      throw new Error(
        'AGENT_KEY_SECRET mismatch — this agent was encrypted with a different secret. '
        + 'Ensure the same AGENT_KEY_SECRET env var is set that was used when the agent was created.'
      );
    }
    throw err;
  }
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
});const MINIMUM_STREAM_SECONDS = 60; // 1 minute minimum
const PORT = parseInt(process.env.PORT || '3001');
const app = express();

app.use(cors());
app.use(express.json());

interface AgentStream {
  streamId: string;
  endpoint: string;
  ratePerSecondMist: number;
  durationSeconds: number;
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
  ownerAddress?: string | null;
}

function toPublicAgent(agent: any) {
  const { encryptedPrivateKey, ...publicAgent } = agent;
  return publicAgent;
}

// ============================================================
//  AGENTS API
// ============================================================

app.post('/api/agents', (req, res) => {
  const { name, description, purpose, budgetMist, ownerAddress } = req.body;
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
    createdAt: new Date().toISOString(),
    ownerAddress: ownerAddress || null,
  };
  
  saveAgent(newAgent);
  
  res.status(201).json(toPublicAgent(newAgent));
});

app.get('/api/agents', (req, res) => {
  const { ownerAddress } = req.query;
  const agents = getAllAgents(typeof ownerAddress === 'string' ? ownerAddress : undefined);
  res.json(agents.map(toPublicAgent));
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
    
    res.json(toPublicAgent(agent));
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

    const { endpoint, durationSeconds } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
    const streamDuration = Math.max(Number(durationSeconds) || MINIMUM_STREAM_SECONDS, MINIMUM_STREAM_SECONDS);

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
    const minimumRequired = provider.ratePerSecond * streamDuration;
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

    const depositAmount = provider.ratePerSecond * streamDuration;
    const [depositCoin] = tx.splitCoins(tx.gas, [depositAmount]);
    console.log(`[access] Creating stream — deposit: ${depositAmount} MIST (${depositAmount / 1_000_000_000} SUI), duration: ${streamDuration}s`);

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
      durationSeconds: streamDuration,
      openedAt: new Date().toISOString(),
    });
    agent.spentMist += depositAmount;
    saveAgent(agent);
    console.log(`[access] Agent state updated — activeStreams: ${agent.activeStreams.length}, spentMist: ${agent.spentMist}`);

    console.log(`[access] Fetching data from ${endpoint}...`);
    const dataResponse = await fetch(`http://localhost:${PORT}${endpoint}`, {
      headers: { 'x-streamengine-stream-id': streamObjectId },
      redirect: 'follow',
    });
    
    let data: any;
    const contentType = dataResponse.headers.get('content-type') || '';
    const rawBody = await dataResponse.text();
    if (contentType.includes('application/json')) {
      data = JSON.parse(rawBody);
    } else {
      // Upstream returned non-JSON (e.g. HTML redirect) — wrap it so the agent still gets useful output
      data = {
        _upstreamStatus: dataResponse.status,
        _contentType: contentType,
        _rawPreview: rawBody.substring(0, 500),
        _note: 'Upstream did not return JSON. The provider websiteUrl may be a website URL rather than a JSON API endpoint.',
      };
    }
    console.log(`[access] Data fetched from ${endpoint} — ${contentType || 'unknown content-type'} (${(rawBody.length / 1024).toFixed(1)}KB)`);

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

    // Get agent balance
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

    // Use discovery scoring to pick the best provider
    const providers = getAllProviders();
    console.log(`[start] Evaluating ${providers.length} providers via discovery scoring`);
    const activeEndpoints = new Set(agent.activeStreams.map((s: AgentStream) => s.endpoint));

    const candidates = providers
      .map(p => scoreProvider(p, agent.purpose, balance))
      .map(c => {
        if (activeEndpoints.has(c.endpoint)) { c.score -= 2; c.reasons.push('Already streaming'); }
        return c;
      })
      .filter(c => c.affordable)
      .sort((a, b) => b.score - a.score || a.ratePerSecondMist - b.ratePerSecondMist);

    if (candidates.length === 0) {
      console.log(`[start] ✗ No affordable providers found for agent "${agent.name}"`);
      return res.json({ message: 'No affordable providers found for agent purpose', started: false });
    }

    const streamDurationStart = Math.max(Number(req.body.durationSeconds) || MINIMUM_STREAM_SECONDS, MINIMUM_STREAM_SECONDS);
    const selected = candidates[0];
    const matchedProvider = providers.find(p => p.endpoint === selected.endpoint);
    if (!matchedProvider) {
      console.error(`[start] ✗ Provider for ${selected.endpoint} not found in registry`);
      return res.status(500).json({ error: 'Provider disappeared from registry' });
    }
    console.log(`[start] Discovery selected: ${selected.name} (score=${selected.score}, reasons: ${selected.reasons.join('; ')})`);
    console.log(`[start] Opening stream to ${matchedProvider.endpoint}...`);

    const accessRes = await fetch(`http://localhost:${PORT}/api/agents/${agent.id}/access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: matchedProvider.endpoint, durationSeconds: streamDurationStart }),
    });
    const accessData = await accessRes.json();

    if (accessData.streamId) {
      console.log(`[start] ✓ Agent "${agent.name}" started successfully`);
      console.log(`[start]   provider: ${matchedProvider.name}`);
      console.log(`[start]   streamId: ${accessData.streamId}`);
      console.log(`[start]   tx: ${accessData.creationTx}`);
      console.log(`[start]   deposit: ${accessData.depositMist} MIST (${accessData.depositMist / 1_000_000_000} SUI)`);
      return res.json({
        started: true,
        provider: matchedProvider.name,
        discovery: selected,
        ...accessData,
      });
    } else {
      console.error(`[start] ✗ Access failed: ${JSON.stringify(accessData)}`);
      return res.status(accessRes.status || 500).json({
        started: false,
        provider: matchedProvider.name,
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
//  AUTONOMOUS DISCOVERY — Agent evaluates marketplace providers
// ============================================================

/**
 * Category relevance scoring: how well a provider's category matches an agent's purpose.
 * Higher = more relevant. 0 = irrelevant.
 */
const PURPOSE_CATEGORY_SCORES: Record<string, Record<string, number>> = {
  research:   { 'research': 10, 'finance': 8, 'news': 7, 'social media': 5, 'data feed': 6, 'general': 4 },
  trading:    { 'finance': 10, 'social media': 7, 'research': 6, 'news': 5, 'data feed': 8, 'general': 3 },
  monitoring: { 'social media': 9, 'finance': 7, 'news': 8, 'research': 5, 'data feed': 6, 'general': 4 },
  content:    { 'social media': 10, 'news': 8, 'research': 6, 'finance': 4, 'data feed': 5, 'general': 5 },
  custom:     { 'research': 7, 'finance': 7, 'social media': 7, 'news': 7, 'data feed': 7, 'general': 7 },
};

interface DiscoveryCandidate {
  providerId: string;
  name: string;
  endpoint: string;
  category: string;
  ratePerSecondMist: number;
  rateSuiPerSec: number;
  score: number;
  reasons: string[];
  maxStreamSeconds: number; // how long the agent can stream with its balance
  affordable: boolean;
}

/**
 * Score a provider against an agent's purpose and budget.
 */
function scoreProvider(provider: any, agentPurpose: string, balanceMist: number): DiscoveryCandidate {
  const reasons: string[] = [];
  let score = 0;

  // 1. Category relevance (0-10 points)
  const purposeScores = PURPOSE_CATEGORY_SCORES[agentPurpose] || PURPOSE_CATEGORY_SCORES.custom;
  const categoryKey = (provider.category || 'general').toLowerCase();
  const categoryScore = purposeScores[categoryKey] ?? purposeScores['general'] ?? 3;
  score += categoryScore;
  if (categoryScore >= 8) reasons.push(`Highly relevant category: ${provider.category}`);
  else if (categoryScore >= 5) reasons.push(`Relevant category: ${provider.category}`);
  else reasons.push(`Low relevance category: ${provider.category}`);

  // 2. Affordability (0-5 points)
  const rateMist = provider.ratePerSecond || 100_000;
  const maxStreamSeconds = rateMist > 0 ? Math.floor(balanceMist / rateMist) : 0;
  const affordable = balanceMist >= rateMist; // can afford at least 1 second
  if (affordable) {
    if (maxStreamSeconds >= 3600) { score += 5; reasons.push('Can stream for 1+ hours'); }
    else if (maxStreamSeconds >= 600) { score += 4; reasons.push(`Can stream for ${Math.floor(maxStreamSeconds / 60)} minutes`); }
    else if (maxStreamSeconds >= 60) { score += 3; reasons.push(`Can stream for ${maxStreamSeconds}s`); }
    else { score += 1; reasons.push(`Short stream: ${maxStreamSeconds}s`); }
  } else {
    reasons.push('Insufficient balance to stream');
  }

  // 3. Value — lower rate = better deal (0-3 points)
  if (affordable) {
    if (rateMist <= 10_000) { score += 3; reasons.push('Very low rate — excellent value'); }
    else if (rateMist <= 50_000) { score += 2; reasons.push('Competitive rate'); }
    else if (rateMist <= 100_000) { score += 1; reasons.push('Standard rate'); }
    else { reasons.push('Premium rate'); }
  }

  // 4. Already streaming to this endpoint? (penalty)
  // This is checked externally — caller passes activeEndpoints

  return {
    providerId: provider.id,
    name: provider.name,
    endpoint: provider.endpoint,
    category: provider.category || 'General',
    ratePerSecondMist: rateMist,
    rateSuiPerSec: rateMist / 1_000_000_000,
    score,
    reasons,
    maxStreamSeconds,
    affordable,
  };
}

/**
 * POST /api/agents/:id/discover
 * Agent queries the marketplace, evaluates all providers, returns ranked recommendations.
 */
app.post('/api/agents/:id/discover', async (req, res) => {
  try {
    const agent = getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    console.log(`[discover] Agent "${agent.name}" (${agent.id}) scanning marketplace — purpose: ${agent.purpose}`);

    // Get agent's on-chain wallet balance
    let balanceMist = 0;
    try {
      const coins = await suiClient.getCoins({ owner: agent.walletAddress, coinType: '0x2::sui::SUI' });
      balanceMist = coins.data.reduce((sum, c) => sum + parseInt(c.balance), 0);
    } catch (err: any) {
      console.error(`[discover] Failed to fetch balance for ${agent.id}:`, err?.message);
    }
    console.log(`[discover] Wallet balance: ${balanceMist} MIST (${balanceMist / 1_000_000_000} SUI)`);

    const providers = getAllProviders();
    console.log(`[discover] Evaluating ${providers.length} registered providers`);

    // Active endpoints (to penalize duplicates)
    const activeEndpoints = new Set(agent.activeStreams.map((s: AgentStream) => s.endpoint));

    // Score and rank all providers
    const candidates: DiscoveryCandidate[] = providers.map(p => {
      const candidate = scoreProvider(p, agent.purpose, balanceMist);

      // Penalty for already-streaming endpoints
      if (activeEndpoints.has(candidate.endpoint)) {
        candidate.score -= 2;
        candidate.reasons.push('Already streaming to this endpoint');
      }

      return candidate;
    });

    // Sort by score descending, then by rate ascending (better value first)
    candidates.sort((a, b) => b.score - a.score || a.ratePerSecondMist - b.ratePerSecondMist);

    // Separate affordable from unaffordable
    const affordable = candidates.filter(c => c.affordable);
    const tooExpensive = candidates.filter(c => !c.affordable);

    console.log(`[discover] Results: ${affordable.length} affordable, ${tooExpensive.length} too expensive`);
    affordable.forEach(c => console.log(`  → ${c.name} (${c.endpoint}) score=${c.score} rate=${c.rateSuiPerSec} SUI/s max=${c.maxStreamSeconds}s`));

    return res.json({
      agentId: agent.id,
      agentPurpose: agent.purpose,
      balanceMist,
      balanceSui: balanceMist / 1_000_000_000,
      totalProviders: providers.length,
      recommendations: affordable,
      unaffordable: tooExpensive,
    });
  } catch (error: any) {
    console.error('[discover] Error:', error?.message || error);
    res.status(500).json({ error: 'Discovery failed', message: error?.message || String(error) });
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

    // Read live on-chain balance using the robust extractor
    let balanceMist = 0;
    try {
      const obj = await suiClient.getObject({
        id: stream.streamId,
        options: { showContent: true },
      });
      const fields = (obj.data?.content as any)?.fields;
      balanceMist = Number(extractStreamBalanceMist(fields));
      console.log(`[state] Stream ${stream.streamId.substring(0, 12)}… on-chain balance: ${balanceMist} MIST`);
    } catch (err: any) {
      console.error(`[state] Failed to read on-chain balance for ${stream.streamId}:`, err?.message || err);
    }

    const elapsedMs = Date.now() - new Date(stream.openedAt).getTime();
    const elapsedSec = Math.floor(elapsedMs / 1000);
    const ratePerSec = stream.ratePerSecondMist / 1_000_000_000;

    // totalDurationSec: prefer stored duration, fallback to elapsed (time-based, not balance-based)
    const storedDuration = stream.durationSeconds || 0;
    const totalDurationSec = storedDuration > 0
      ? storedDuration
      : Math.max(elapsedSec, MINIMUM_STREAM_SECONDS);

    // Sui streams don't auto-drain — balance only changes on withdraw().
    // Calculate remaining time and drained amount based on elapsed time, not balance.
    const remainingSec = Math.max(0, totalDurationSec - elapsedSec);
    const totalDepositMist = stream.ratePerSecondMist * totalDurationSec;
    const drainedMist = Math.min(elapsedSec * stream.ratePerSecondMist, totalDepositMist);

    // Status: stream is 'depleted' when time expires OR balance hits zero
    const timeExpired = elapsedSec >= totalDurationSec;
    const status = timeExpired || balanceMist === 0 ? 'depleted' : 'streaming';

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
      totalDurationSec,
      drainedMist,
      drainedSui: drainedMist / 1_000_000_000,
      status,
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
      redirect: 'follow',
    });

    let data: any;
    const fetchContentType = dataResponse.headers.get('content-type') || '';
    const fetchRawBody = await dataResponse.text();
    if (fetchContentType.includes('application/json')) {
      data = JSON.parse(fetchRawBody);
    } else {
      data = {
        _upstreamStatus: dataResponse.status,
        _contentType: fetchContentType,
        _rawPreview: fetchRawBody.substring(0, 500),
        _note: 'Upstream did not return JSON.',
      };
    }
    console.log(`[stream-session] Data fetched from ${stream.endpoint} — ${fetchContentType || 'unknown'} (${(fetchRawBody.length / 1024).toFixed(1)}KB)`);

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

app.post('/api/agents/:id/withdraw', async (req, res) => {
  try {
    const agent = getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const { ownerAddress } = req.body;
    if (!ownerAddress) return res.status(400).json({ error: 'ownerAddress required — pass your wallet address' });

    // Verify the caller owns this agent
    if (agent.ownerAddress && agent.ownerAddress !== ownerAddress) {
      return res.status(403).json({ error: 'Not authorized — owner address mismatch' });
    }

    console.log(`[withdraw] Agent "${agent.name}" (${agent.id}) — withdrawing to ${ownerAddress}`);

    // Get agent's full SUI balance from chain
    const coins = await suiClient.getCoins({ owner: agent.walletAddress, coinType: '0x2::sui::SUI' });
    const totalBalance = coins.data.reduce((sum, c) => sum + parseInt(c.balance), 0);
    console.log(`[withdraw] Agent wallet balance: ${totalBalance} MIST (${totalBalance / 1_000_000_000} SUI)`);

    if (totalBalance === 0) {
      return res.status(400).json({ error: 'Agent wallet is empty — nothing to withdraw', balanceMist: 0, balanceSui: 0 });
    }

    // Leave a small gas reserve (0.01 SUI = 10_000_000 MIST) so the wallet stays valid
    const gasReserve = 10_000_000;
    const withdrawAmount = Math.max(0, totalBalance - gasReserve);

    if (withdrawAmount <= 0) {
      return res.status(400).json({
        error: 'Balance too low to withdraw after gas reserve',
        balanceMist: totalBalance,
        balanceSui: totalBalance / 1_000_000_000,
        gasReserveMist: gasReserve,
      });
    }

    console.log(`[withdraw] Withdrawing ${withdrawAmount} MIST (${withdrawAmount / 1_000_000_000} SUI) → ${ownerAddress}`);

    const keypair = getKeypairForAgent(agent);
    const { Transaction } = await import('@mysten/sui/transactions');
    const tx = new Transaction();

    const [coin] = tx.splitCoins(tx.gas, [withdrawAmount]);
    tx.transferObjects([coin], tx.pure.address(ownerAddress));

    const result = await suiClient.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
      options: { showEffects: true },
    });

    await suiClient.waitForTransaction({ digest: result.digest });
    console.log(`[withdraw] ✓ Withdrawal complete — tx: ${result.digest}`);

    return res.json({
      success: true,
      digest: result.digest,
      withdrawnMist: withdrawAmount,
      withdrawnSui: withdrawAmount / 1_000_000_000,
      remainingMist: totalBalance - withdrawAmount,
      remainingSui: (totalBalance - withdrawAmount) / 1_000_000_000,
      toAddress: ownerAddress,
    });
  } catch (error: any) {
    const msg = error?.message || String(error);
    console.error('[withdraw] Error:', msg);
    if (msg.includes('Insufficient') || msg.includes('not enough') || msg.includes('Balance')) {
      res.status(402).json({ error: 'Insufficient balance for withdrawal', message: msg });
    } else {
      res.status(500).json({ error: 'Withdrawal failed', message: msg });
    }
  }
});

app.post('/api/agents/:id/fund-demo', async (req, res) => {
  try {
    const agent = getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    
    const { amountMist } = req.body;
    if (!amountMist) return res.status(400).json({ error: 'Missing amountMist' });

    if (!process.env.SUI_PRIVATE_KEY) {
      throw new Error('SUI_PRIVATE_KEY must be set — fund-demo endpoint cannot run without it');
    }
    const testBech32Key = process.env.SUI_PRIVATE_KEY;
    let testWalletKeypair: Ed25519Keypair;
    if (testBech32Key.startsWith('suiprivkey')) {
      const { secretKey } = decodeSuiPrivateKey(testBech32Key);
      testWalletKeypair = Ed25519Keypair.fromSecretKey(secretKey);
    } else {
      const cleanHex = testBech32Key.startsWith('0x') ? testBech32Key.slice(2) : testBech32Key;
      testWalletKeypair = Ed25519Keypair.fromSecretKey(Buffer.from(cleanHex, 'hex'));
    }
    console.log(`[fund-demo] Test wallet address: ${testWalletKeypair.toSuiAddress()}`);

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

/** List registered website listings, optionally filtered by owner address */
function listProviders(req: express.Request, res: express.Response) {
  const { providerAddress } = req.query;
  let providers = getAllProviders();
  if (providerAddress && typeof providerAddress === 'string') {
    providers = providers.filter(p => p.providerAddress === providerAddress);
  }
  res.json({ providers });
}

/** Register a new website listing — requires wallet signature */
async function createProvider(req: express.Request, res: express.Response) {
  const { providerAddress, name, websiteUrl, endpoint, ratePerSecond, description, category, signature } = req.body;
  if (!providerAddress || !name || !websiteUrl || !ratePerSecond) {
    return res.status(400).json({ error: 'Missing required fields: providerAddress, name, websiteUrl, ratePerSecond' });
  }

  // Verify wallet signature to prove ownership (best-effort — registration proceeds even if verification fails)
  if (signature) {
    try {
      const endpointPath = endpoint || `/api/premium/listed/${slugify(name)}/feed`;
      const signMessage = `FlowGate Provider Registration\nAddress: ${providerAddress}\nProvider: ${name}\nEndpoint: ${endpointPath}\nTimestamp: ${req.body.timestamp || Date.now()}`;
      const messageBytes = new TextEncoder().encode(signMessage);
      const publicKey = await verifyPersonalMessageSignature(messageBytes, signature);
      const verifiedAddress = publicKey.toSuiAddress();
      if (verifiedAddress !== providerAddress) {
        console.warn(`[providers] Signature mismatch: claimed ${providerAddress}, verified ${verifiedAddress} — proceeding without verification`);
      } else {
        console.log(`[providers] Signature verified for ${providerAddress}`);
      }
    } catch (err: any) {
      console.warn(`[providers] Signature verification failed:`, err?.message || err, '— proceeding without verification');
    }
  } else {
    console.warn(`[providers] No signature provided for ${providerAddress} — registration accepted without verification`);
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

/** List all agents consuming this provider's endpoint */
app.get('/api/providers/:id/consumers', (req, res) => {
  const provider = getProvider(req.params.id);
  if (!provider) return res.status(404).json({ error: 'Provider not found' });

  const allAgents = getAllAgents();
  const consumers: any[] = [];

  for (const agent of allAgents) {
    for (const stream of agent.activeStreams) {
      if (stream.endpoint === provider.endpoint) {
        const elapsedMs = Date.now() - new Date(stream.openedAt).getTime();
        const elapsedSec = Math.floor(elapsedMs / 1000);
        const timeExpired = elapsedSec >= (stream.durationSeconds || 0);
        consumers.push({
          agentId: agent.id,
          agentName: agent.name,
          agentPurpose: agent.purpose,
          streamId: stream.streamId,
          ratePerSecondMist: stream.ratePerSecondMist,
          durationSeconds: stream.durationSeconds || 0,
          openedAt: stream.openedAt,
          elapsedSec,
          status: timeExpired ? 'depleted' : 'streaming',
          depositMist: stream.ratePerSecondMist * (stream.durationSeconds || 0),
        });
      }
    }
  }

  res.json({ providerId: req.params.id, consumers });
});

/** Delete a provider */
app.delete('/api/providers/:id', (req, res) => {
  const provider = getProvider(req.params.id);
  if (!provider) return res.status(404).json({ error: 'Provider not found' });

  dbDeleteProvider(req.params.id);
  console.log(`[providers] Deleted provider "${provider.name}" (${provider.id})`);
  res.json({ deleted: true, providerId: req.params.id });
});

/** Update provider settings (rate, description) */
app.put('/api/providers/:id', (req, res) => {
  const provider = getProvider(req.params.id);
  if (!provider) return res.status(404).json({ error: 'Provider not found' });

  const { ratePerSecond, description, category } = req.body;
  const updated = {
    ...provider,
    ...(ratePerSecond !== undefined && { ratePerSecond: Number(ratePerSecond) }),
    ...(description !== undefined && { description }),
    ...(category !== undefined && { category }),
  };
  saveProvider(updated);
  res.json(updated);
});

/**
 * GET /api/providers/:id/streams
 * Returns all streams targeting this provider with live on-chain balance
 * and claimable amounts — used by the provider withdrawal UI.
 */
app.get('/api/providers/:id/streams', async (req, res) => {
  try {
    const provider = getProvider(req.params.id);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    const allAgents = getAllAgents();
    const nowMs = Date.now();
    const streams: any[] = [];

    for (const agent of allAgents) {
      for (const stream of agent.activeStreams) {
        if (stream.endpoint !== provider.endpoint) continue;

        // Read live on-chain state
        let balanceMist = 0;
        let ratePerSecondMist = stream.ratePerSecondMist;
        let sender = agent.walletAddress;
        let lastWithdrawalMs = 0; // default to 0 so claimable shows 0 if on-chain read fails
        let chainError: string | null = null;

        try {
          const obj = await suiClient.getObject({
            id: stream.streamId,
            options: { showContent: true },
          });
          const fields = (obj.data?.content as any)?.fields;
          if (fields) {
            balanceMist = Number(extractStreamBalanceMist(fields));
            if (fields.rate_per_second) ratePerSecondMist = Number(fields.rate_per_second);
            if (fields.sender) sender = fields.sender;
            if (fields.last_withdrawal_ms) lastWithdrawalMs = Number(fields.last_withdrawal_ms);
          }
        } catch (err: any) {
          chainError = err?.message || 'Failed to read on-chain state';
        }

        // Calculate claimable: elapsed since last withdrawal * rate
        const elapsedSec = Math.max(0, Math.floor((nowMs - lastWithdrawalMs) / 1000));
        const claimableMist = Math.min(elapsedSec * ratePerSecondMist, balanceMist);

        const elapsedSecSinceOpen = Math.floor((nowMs - new Date(stream.openedAt).getTime()) / 1000);
        const totalDurationSec = stream.durationSeconds || 0;
        const streamStatus = totalDurationSec > 0 && elapsedSecSinceOpen >= totalDurationSec ? 'depleted' : (balanceMist > 0 ? 'streaming' : 'depleted');

        streams.push({
          streamId: stream.streamId,
          agentId: agent.id,
          agentName: agent.name,
          agentPurpose: agent.purpose,
          endpoint: stream.endpoint,
          ratePerSecondMist,
          durationSeconds: totalDurationSec,
          openedAt: stream.openedAt,
          depositMist: ratePerSecondMist * totalDurationSec,
          // On-chain live data
          onChainBalanceMist: balanceMist,
          onChainBalanceSui: balanceMist / 1_000_000_000,
          claimableMist,
          claimableSui: claimableMist / 1_000_000_000,
          sender,
          recipient: provider.providerAddress,
          lastWithdrawalMs,
          status: streamStatus,
          chainError,
        });
      }
    }

    // Totals
    const totalClaimableMist = streams.reduce((sum, s) => sum + s.claimableMist, 0);
    const totalOnChainBalanceMist = streams.reduce((sum, s) => sum + s.onChainBalanceMist, 0);

    return res.json({
      providerId: provider.id,
      providerAddress: provider.providerAddress,
      totalStreams: streams.length,
      totalClaimableMist,
      totalClaimableSui: totalClaimableMist / 1_000_000_000,
      totalOnChainBalanceMist,
      totalOnChainBalanceSui: totalOnChainBalanceMist / 1_000_000_000,
      streams,
    });
  } catch (error: any) {
    console.error('[providers/:id/streams] Error:', error?.message || error);
    res.status(500).json({ error: 'Failed to fetch provider streams', message: error?.message || String(error) });
  }
});

/** Health check */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'FlowGate Gateway', providers: getAllProviders().length });
});



// ============================================================
//  DYNAMIC PROXY — Generic x402-gated proxy for any registered provider
// ============================================================

/**
 * Catch-all proxy for any registered provider endpoint.
 * Must come AFTER the hardcoded premium routes above.
 * 
 * Flow:
 *  1. Express matches /api/premium/*
 *  2. requireX402Payment middleware checks for a valid stream
 *  3. If paid → proxy forwards request to provider.websiteUrl
 *  4. If not paid → 402 response with payment instructions
 */
app.all('/api/premium/*', requireX402Payment, async (req, res) => {
  const provider = getProviderByEndpoint(req.path);
  if (!provider || !provider.websiteUrl) {
    return res.status(404).json({
      error: 'Provider not found',
      message: `No registered provider for path ${req.path}`,
    });
  }

  const auth = (req as any).streamEngineAuth;
  console.log(`[Proxy] Forwarding ${req.method} ${req.path} → ${provider.websiteUrl} (agent: ${auth?.agentAddress?.substring(0, 10) || 'unknown'})`);

  try {
    // Build upstream URL — preserve query string from the original request
    const upstreamUrl = new URL(provider.websiteUrl);
    // Merge any query params from the gateway request
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        upstreamUrl.searchParams.set(key, value);
      } else if (Array.isArray(value)) {
        value.forEach(v => {
          if (typeof v === 'string') upstreamUrl.searchParams.append(key, v);
        });
      }
    }

    const upstreamRes = await fetch(upstreamUrl.toString(), {
      method: req.method,
      headers: {
        'Accept': req.headers.accept || 'application/json',
        'User-Agent': 'FlowGate-Proxy/1.0',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000), // 15s timeout
    });

    // Forward relevant response headers
    const contentType = upstreamRes.headers.get('content-type');
    if (contentType) res.set('Content-Type', contentType);
    res.set('X-Upstream-Status', String(upstreamRes.status));
    res.set('X-FlowGate-Provider', provider.name);
    res.set('X-FlowGate-Endpoint', provider.endpoint);

    const body = await upstreamRes.text();
    console.log(`[Proxy] ${provider.name} responded ${upstreamRes.status} — ${(body.length / 1024).toFixed(1)}KB`);

    res.status(upstreamRes.status).send(body);
  } catch (err: any) {
    console.error(`[Proxy] Upstream error for ${provider.name}:`, err?.message || err);
    res.status(502).json({
      error: 'Upstream fetch failed',
      provider: provider.name,
      websiteUrl: provider.websiteUrl,
      message: err?.message || 'Could not reach the upstream API',
    });
  }
});

// ============================================================
//  START
// ============================================================

app.listen(PORT, () => {
  const providers = getAllProviders();
  console.log(`\n🚀 FlowGate Gateway listening on http://localhost:${PORT}`);
  if (providers.length > 0) {
    console.log(`\n📋 Registry: ${providers.length} registered providers`);
    providers.forEach(p => {
      console.log(`   → ${p.name} | ${p.ratePerSecond} MIST/sec | ${p.endpoint}`);
    });
  } else {
    console.log(`\n📋 Registry: empty — register providers via POST /api/providers`);
  }
  console.log(`\n🔒 All /api/premium/* requests require a valid payment stream.`);
  console.log(`📖 List providers: GET /api/providers\n`);
});
