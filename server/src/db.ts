import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set');
}

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

// Create tables if they don't exist
export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      purpose TEXT NOT NULL,
      budget_mist BIGINT NOT NULL DEFAULT 0,
      spent_mist BIGINT NOT NULL DEFAULT 0,
      wallet_address TEXT NOT NULL,
      encrypted_private_key TEXT NOT NULL,
      active_streams TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      owner_address TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      website_url TEXT DEFAULT '',
      endpoint TEXT NOT NULL,
      rate_per_second BIGINT NOT NULL,
      category TEXT DEFAULT '',
      sui_address TEXT NOT NULL,
      earnings_mist BIGINT NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `;

  await sql`ALTER TABLE agents ADD COLUMN IF NOT EXISTS owner_address TEXT`;
}

// Agent helpers
export async function saveAgent(agent: any): Promise<void> {
  await sql`
    INSERT INTO agents (id, name, description, purpose, budget_mist, spent_mist,
      wallet_address, encrypted_private_key, active_streams, created_at, owner_address)
    VALUES (${agent.id}, ${agent.name}, ${agent.description ?? ''}, ${agent.purpose},
      ${agent.budgetMist}, ${agent.spentMist}, ${agent.walletAddress},
      ${agent.encryptedPrivateKey}, ${JSON.stringify(agent.activeStreams ?? [])},
      ${agent.createdAt}, ${agent.ownerAddress ?? null})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      purpose = EXCLUDED.purpose,
      budget_mist = EXCLUDED.budget_mist,
      spent_mist = EXCLUDED.spent_mist,
      wallet_address = EXCLUDED.wallet_address,
      encrypted_private_key = EXCLUDED.encrypted_private_key,
      active_streams = EXCLUDED.active_streams,
      owner_address = EXCLUDED.owner_address
  `;
}

export async function getAgent(id: string): Promise<any | null> {
  const rows = await sql`SELECT * FROM agents WHERE id = ${id}`;
  return rows[0] ? rowToAgent(rows[0]) : null;
}

export async function getAllAgents(ownerAddress?: string): Promise<any[]> {
  let rows;
  if (ownerAddress) {
    rows = await sql`
      SELECT * FROM agents
      WHERE owner_address = ${ownerAddress}
      ORDER BY created_at DESC
    `;
  } else {
    rows = await sql`SELECT * FROM agents ORDER BY created_at DESC`;
  }
  // Ensure rows is an array before mapping
  if (!Array.isArray(rows)) {
    console.error('[getAllAgents] Expected array but got:', typeof rows, rows);
    return [];
  }
  return rows.map(rowToAgent);
}

function rowToAgent(row: any): any {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    purpose: row.purpose,
    budgetMist: Number(row.budget_mist),
    spentMist: Number(row.spent_mist),
    walletAddress: row.wallet_address,
    encryptedPrivateKey: row.encrypted_private_key,
    activeStreams: JSON.parse(row.active_streams),
    createdAt: row.created_at,
    ownerAddress: row.owner_address,
  };
}

// Provider helpers
export async function saveProvider(provider: any): Promise<void> {
  await sql`
    INSERT INTO providers (id, name, description, website_url, endpoint,
      rate_per_second, category, sui_address, earnings_mist, created_at)
    VALUES (${provider.id}, ${provider.name}, ${provider.description ?? ''},
      ${provider.websiteUrl ?? ''}, ${provider.endpoint}, ${provider.ratePerSecond},
      ${provider.category ?? ''}, ${provider.sui_address || provider.providerAddress},
      ${provider.earningsMist ?? 0}, ${provider.createdAt ?? provider.registeredAt ?? new Date().toISOString()})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      website_url = EXCLUDED.website_url,
      rate_per_second = EXCLUDED.rate_per_second,
      category = EXCLUDED.category
  `;
}

export async function getProvider(id: string): Promise<any | null> {
  const rows = await sql`SELECT * FROM providers WHERE id = ${id}`;
  return rows[0] ? rowToProvider(rows[0]) : null;
}

export async function getAllProviders(): Promise<any[]> {
  const rows = await sql`SELECT * FROM providers ORDER BY created_at DESC`;
  return rows.map(rowToProvider);
}

export async function deleteAgent(id: string): Promise<boolean> {
  const result = await sql`DELETE FROM agents WHERE id = ${id}`;
  return result.count > 0;
}

export async function deleteProvider(id: string): Promise<boolean> {
  const result = await sql`DELETE FROM providers WHERE id = ${id}`;
  return result.count > 0;
}

export async function updateProviderEarnings(id: string, additionalMist: number): Promise<void> {
  await sql`UPDATE providers SET earnings_mist = earnings_mist + ${additionalMist} WHERE id = ${id}`;
}

export async function getProviderByEndpoint(endpoint: string): Promise<any | null> {
  const rows = await sql`SELECT * FROM providers WHERE endpoint = ${endpoint}`;
  return rows[0] ? rowToProvider(rows[0]) : null;
}

function rowToProvider(row: any): any {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    websiteUrl: row.website_url,
    endpoint: row.endpoint,
    ratePerSecond: Number(row.rate_per_second),
    category: row.category,
    providerAddress: row.sui_address, // mapping back to providerAddress used by index.ts
    sui_address: row.sui_address,
    earningsMist: Number(row.earnings_mist),
    createdAt: row.created_at,
  };
}

export default sql;
