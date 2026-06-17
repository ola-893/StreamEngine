import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'streamengine.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    purpose TEXT NOT NULL,
    budget_mist INTEGER NOT NULL DEFAULT 0,
    spent_mist INTEGER NOT NULL DEFAULT 0,
    wallet_address TEXT NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    active_streams TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    website_url TEXT,
    endpoint TEXT NOT NULL,
    rate_per_second INTEGER NOT NULL,
    category TEXT,
    sui_address TEXT NOT NULL,
    earnings_mist INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
`);

// Agent helpers
export function saveAgent(agent: any): void {
  db.prepare(`
    INSERT OR REPLACE INTO agents
    (id, name, description, purpose, budget_mist, spent_mist, wallet_address,
     encrypted_private_key, active_streams, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    agent.id, agent.name, agent.description ?? '', agent.purpose,
    agent.budgetMist, agent.spentMist, agent.walletAddress,
    agent.encryptedPrivateKey, JSON.stringify(agent.activeStreams ?? []),
    agent.createdAt
  );
}

export function getAgent(id: string): any | null {
  const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as any;
  if (!row) return null;
  return rowToAgent(row);
}

export function getAllAgents(): any[] {
  const rows = db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all() as any[];
  return rows.map(rowToAgent);
}

function rowToAgent(row: any): any {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    purpose: row.purpose,
    budgetMist: row.budget_mist,
    spentMist: row.spent_mist,
    walletAddress: row.wallet_address,
    encryptedPrivateKey: row.encrypted_private_key,
    activeStreams: JSON.parse(row.active_streams),
    createdAt: row.created_at,
  };
}

// Provider helpers
export function saveProvider(provider: any): void {
  db.prepare(`
    INSERT OR REPLACE INTO providers
    (id, name, description, website_url, endpoint, rate_per_second,
     category, sui_address, earnings_mist, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    provider.id, provider.name, provider.description ?? '',
    provider.websiteUrl ?? '', provider.endpoint, provider.ratePerSecond,
    provider.category ?? '', provider.sui_address || provider.providerAddress,
    provider.earningsMist ?? 0,
    provider.createdAt ?? provider.registeredAt ?? new Date().toISOString()
  );
}

export function getProvider(id: string): any | null {
  const row = db.prepare('SELECT * FROM providers WHERE id = ?').get(id) as any;
  if (!row) return null;
  return rowToProvider(row);
}

export function getAllProviders(): any[] {
  const rows = db.prepare('SELECT * FROM providers ORDER BY created_at DESC').all() as any[];
  return rows.map(rowToProvider);
}

export function updateProviderEarnings(id: string, additionalMist: number): void {
  db.prepare('UPDATE providers SET earnings_mist = earnings_mist + ? WHERE id = ?')
    .run(additionalMist, id);
}

export function getProviderByEndpoint(endpoint: string): any | null {
  const row = db.prepare('SELECT * FROM providers WHERE endpoint = ?').get(endpoint) as any;
  if (!row) return null;
  return rowToProvider(row);
}

function rowToProvider(row: any): any {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    websiteUrl: row.website_url,
    endpoint: row.endpoint,
    ratePerSecond: row.rate_per_second,
    category: row.category,
    providerAddress: row.sui_address, // mapping back to providerAddress used by index.ts
    sui_address: row.sui_address,
    earningsMist: row.earnings_mist,
    createdAt: row.created_at,
  };
}

export default db;
