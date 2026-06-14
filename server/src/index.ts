import express from 'express';
import cors from 'cors';
import { requireX402Payment } from './x402/middleware.ts';
import {
  getProviderById,
  getProviderEarnings,
  getProviders,
  registerProvider,
} from './registry/providers.ts';
import { readStreamObjectState } from './x402/streams.ts';

const PORT = parseInt(process.env.PORT || '3001');
const app = express();

app.use(cors());
app.use(express.json());

interface Agent {
  id: string;
  name: string;
  description: string;
  purpose: 'research' | 'trading' | 'custom';
  budgetMist: number;
  spentMist: number;
  activeStreamId?: string;
  createdAt: string;
}
const agentRegistry: Map<string, Agent> = new Map();

// ============================================================
//  AGENTS API
// ============================================================

app.post('/api/agents', (req, res) => {
  const { name, description, purpose, budgetMist } = req.body;
  if (!name || !purpose || budgetMist === undefined) {
    return res.status(400).json({ error: 'Missing required fields: name, purpose, budgetMist' });
  }
  const newAgent: Agent = {
    id: `agent-${Date.now()}`,
    name,
    description: description || '',
    purpose,
    budgetMist: Number(budgetMist),
    spentMist: 0,
    createdAt: new Date().toISOString()
  };
  agentRegistry.set(newAgent.id, newAgent);
  res.status(201).json(newAgent);
});

app.get('/api/agents', (req, res) => {
  res.json(Array.from(agentRegistry.values()));
});

app.get('/api/agents/:id', async (req, res) => {
  const agent = agentRegistry.get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  
  const response: any = { ...agent };
  
  if (agent.activeStreamId) {
    try {
      const stream = await readStreamObjectState(agent.activeStreamId);
      response.remainingBalanceMist = Number(stream.balanceMist);
    } catch (e) {
      console.error('Failed to read stream object state for agent', agent.id, e);
    }
  }
  
  res.json(response);
});

app.patch('/api/agents/:id/stream', (req, res) => {
  const agent = agentRegistry.get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  
  const { streamId, amountMist } = req.body;
  if (!streamId || amountMist === undefined) {
    return res.status(400).json({ error: 'Missing required fields: streamId, amountMist' });
  }
  
  agent.activeStreamId = streamId;
  agent.spentMist += Number(amountMist);
  res.json(agent);
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
  res.json({ providers: getProviders() });
}

/** Register a new website listing */
function createProvider(req: express.Request, res: express.Response) {
  const { providerAddress, name, websiteUrl, endpoint, ratePerSecond, description, category } = req.body;
  if (!providerAddress || !name || !websiteUrl || !ratePerSecond) {
    return res.status(400).json({ error: 'Missing required fields: providerAddress, name, websiteUrl, ratePerSecond' });
  }
  const listing = registerProvider({
    providerAddress,
    name,
    websiteUrl,
    endpoint: endpoint || `/api/premium/listed/${slugify(name)}/feed`,
    ratePerSecond: Number(ratePerSecond),
    description: description || '',
    category: category || 'General',
  });
  res.status(201).json(listing);
}

app.get('/api/providers', listProviders);

app.get('/api/registry/providers', listProviders);

app.post('/api/providers', createProvider);

/** Get a specific provider */
app.get('/api/registry/providers/:id', (req, res) => {
  const provider = getProviderById(req.params.id);
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
  const earnings = getProviderEarnings(req.params.id);
  if (!earnings) return res.status(404).json({ error: 'Provider not found' });
  res.json({
    providerId: req.params.id,
    totalEarnedMist: earnings.totalEarnedMist,
  });
});

/** Health check */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'FlowGate Gateway', providers: getProviders().length });
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
  const providers = getProviders();
  console.log(`\n🚀 FlowGate Gateway listening on http://localhost:${PORT}`);
  console.log(`\n📋 Registry: ${providers.length} websites listed`);
  providers.forEach(p => {
    console.log(`   → ${p.name} | ${p.ratePerSecond} MIST/sec | GET ${p.endpoint}`);
  });
  console.log(`\n🔒 All premium endpoints return 402 Payment Required without a valid stream.`);
  console.log(`📖 Browse listed websites: GET /api/providers\n`);
});
