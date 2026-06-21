/**
 * StreamEngine API Service Layer
 * Centralizes all backend communication for the frontend.
 */

import { API_BASE } from "../types";

// ============================================================
//  Types matching backend schema
// ============================================================

export interface BackendAgent {
  id: string;
  name: string;
  description: string;
  purpose: string;
  budgetMist: number;
  spentMist: number;
  walletAddress: string;
  activeStreams: BackendAgentStream[];
  createdAt: string;
}

export interface BackendAgentStream {
  streamId: string;
  endpoint: string;
  ratePerSecondMist: number;
  durationSeconds: number;
  openedAt: string;
}

export interface AgentBalance {
  agentId: string;
  walletAddress: string;
  balanceMist: number;
  balanceSui: number;
}

export interface AgentStreamsResponse {
  agentId: string;
  streams: (BackendAgentStream & { balanceMist?: number; balanceSui?: number })[];
}

export interface StreamBalance {
  streamId: string;
  balanceMist: number;
  balanceSui: number;
}

export interface AccessResponse {
  streamId: string;
  creationTx: string;
  depositMist: number;
  data: any;
}

export interface StartResponse {
  started: boolean;
  provider?: string;
  streamId?: string;
  creationTx?: string;
  depositMist?: number;
  data?: any;
  message?: string;
}

export interface FundResponse {
  success: boolean;
  digest: string;
  fundedAmountMist: number;
}

export interface CloseStreamResponse {
  closed: boolean;
  streamId: string;
  refundTx: string;
}

export interface DiscoveryCandidate {
  providerId: string;
  name: string;
  endpoint: string;
  category: string;
  ratePerSecondMist: number;
  rateSuiPerSec: number;
  score: number;
  reasons: string[];
  maxStreamSeconds: number;
  affordable: boolean;
}

export interface DiscoveryResponse {
  agentId: string;
  agentPurpose: string;
  balanceMist: number;
  balanceSui: number;
  totalProviders: number;
  recommendations: DiscoveryCandidate[];
  unaffordable: DiscoveryCandidate[];
}

export interface ProviderListing {
  id: string;
  providerAddress: string;
  name: string;
  websiteUrl: string;
  endpoint: string;
  ratePerSecond: number;
  description: string;
  category: string;
  registeredAt: string;
}

export interface ProviderEarnings {
  providerId: string;
  totalEarnedMist: number;
}

export interface HealthStatus {
  status: string;
  service: string;
  providers: number;
}

// ============================================================
//  Agent API
// ============================================================

function requireOwnerAddress(ownerAddress: string | null | undefined): string {
  if (!ownerAddress) {
    throw new Error("Connect your wallet first — owner address is required");
  }
  return ownerAddress;
}

function ownerQuery(ownerAddress: string | null | undefined): string {
  return `ownerAddress=${encodeURIComponent(requireOwnerAddress(ownerAddress))}`;
}

export async function createAgent(params: {
  name: string;
  description?: string;
  purpose: string;
  budgetMist: number;
  ownerAddress: string;
}): Promise<BackendAgent> {
  const res = await fetch(`${API_BASE}/api/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to create agent");
  }
  return res.json();
}

export async function listAgents(ownerAddress: string): Promise<BackendAgent[]> {
  const res = await fetch(`${API_BASE}/api/agents?${ownerQuery(ownerAddress)}`);
  if (!res.ok) throw new Error("Failed to list agents");
  return res.json();
}

export async function getAgent(id: string, ownerAddress: string): Promise<BackendAgent> {
  const res = await fetch(`${API_BASE}/api/agents/${id}?${ownerQuery(ownerAddress)}`);
  if (!res.ok) throw new Error("Agent not found");
  return res.json();
}

export async function getAgentBalance(id: string, ownerAddress: string): Promise<AgentBalance> {
  const res = await fetch(`${API_BASE}/api/agents/${id}/balance?${ownerQuery(ownerAddress)}`);
  if (!res.ok) throw new Error("Failed to fetch agent balance");
  return res.json();
}

export async function listAgentStreams(id: string, ownerAddress: string): Promise<AgentStreamsResponse> {
  const res = await fetch(`${API_BASE}/api/agents/${id}/streams?${ownerQuery(ownerAddress)}`);
  if (!res.ok) throw new Error("Failed to list agent streams");
  return res.json();
}

export async function discoverProviders(agentId: string, ownerAddress: string): Promise<DiscoveryResponse> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownerAddress: requireOwnerAddress(ownerAddress) }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to discover providers");
  }
  return res.json();
}

export async function closeAgentStream(
  agentId: string,
  streamId: string,
  ownerAddress: string
): Promise<CloseStreamResponse> {
  const res = await fetch(
    `${API_BASE}/api/agents/${agentId}/streams/${streamId}?${ownerQuery(ownerAddress)}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error("Failed to close stream");
  return res.json();
}

export async function startAgent(
  agentId: string,
  durationSeconds: number | undefined,
  ownerAddress: string
): Promise<StartResponse> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ durationSeconds, ownerAddress: requireOwnerAddress(ownerAddress) }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || err.message || "Failed to start agent");
  }
  return res.json();
}

export async function accessEndpoint(
  agentId: string,
  endpoint: string,
  ownerAddress: string
): Promise<AccessResponse> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}/access`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint, ownerAddress: requireOwnerAddress(ownerAddress) }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to access endpoint");
  }
  return res.json();
}

export async function fundAgent(
  agentId: string,
  amountMist: number,
  ownerAddress: string
): Promise<FundResponse> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}/fund-demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amountMist, ownerAddress: requireOwnerAddress(ownerAddress) }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to fund agent");
  }
  return res.json();
}

export interface StreamState {
  streamId: string;
  endpoint: string;
  openedAt: string;
  ratePerSecondMist: number;
  rateSuiPerSec: number;
  balanceMist: number;
  balanceSui: number;
  elapsedSec: number;
  remainingSec: number;
  totalDurationSec: number;
  drainedMist: number;
  drainedSui: number;
  status: "streaming" | "depleted";
}

export interface FetchDataResponse {
  data: any;
  balanceMist: number;
  balanceSui: number;
  fetchedAt: string;
  sizeBytes: number;
}

export async function getStreamState(
  agentId: string,
  streamId: string,
  ownerAddress: string
): Promise<StreamState> {
  const res = await fetch(
    `${API_BASE}/api/agents/${agentId}/streams/${streamId}/state?${ownerQuery(ownerAddress)}`
  );
  if (!res.ok) throw new Error("Failed to get stream state");
  return res.json();
}

export async function fetchStreamData(
  agentId: string,
  streamId: string,
  ownerAddress: string
): Promise<FetchDataResponse> {
  const res = await fetch(
    `${API_BASE}/api/agents/${agentId}/streams/${streamId}/fetch-data`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerAddress: requireOwnerAddress(ownerAddress) }),
    }
  );
  if (!res.ok) throw new Error("Failed to fetch stream data");
  return res.json();
}

export interface DeleteAgentResponse {
  deleted: boolean;
  agentId: string;
}

export interface WithdrawResponse {
  success: boolean;
  digest: string;
  withdrawnMist: number;
  withdrawnSui: number;
  remainingMist: number;
  remainingSui: number;
  toAddress: string;
}

export async function withdrawAgent(
  agentId: string,
  ownerAddress: string
): Promise<WithdrawResponse> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownerAddress }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to withdraw");
  }
  return res.json();
}

export async function deleteAgent(agentId: string, ownerAddress: string): Promise<DeleteAgentResponse> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}?${ownerQuery(ownerAddress)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to delete agent");
  }
  return res.json();
}

// ============================================================
//  Provider API
// ============================================================

export async function listProviders(providerAddress?: string): Promise<{ providers: ProviderListing[] }> {
  const url = providerAddress
    ? `${API_BASE}/api/providers?providerAddress=${encodeURIComponent(providerAddress)}`
    : `${API_BASE}/api/providers`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to list providers");
  return res.json();
}

export async function registerProvider(params: {
  providerAddress: string;
  name: string;
  websiteUrl: string;
  endpoint?: string;
  ratePerSecond: number;
  description?: string;
  category?: string;
}): Promise<ProviderListing> {
  const res = await fetch(`${API_BASE}/api/providers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to register provider");
  }
  return res.json();
}

export async function getProviderEarnings(
  providerId: string
): Promise<ProviderEarnings> {
  const res = await fetch(`${API_BASE}/api/providers/${providerId}/earnings`);
  if (!res.ok) throw new Error("Provider not found");
  return res.json();
}

export interface ProviderConsumer {
  agentId: string;
  agentName: string;
  agentPurpose: string;
  streamId: string;
  ratePerSecondMist: number;
  durationSeconds: number;
  openedAt: string;
  elapsedSec: number;
  status: "streaming" | "depleted";
  depositMist: number;
}

export interface ProviderConsumersResponse {
  providerId: string;
  consumers: ProviderConsumer[];
}

export async function getProviderConsumers(
  providerId: string
): Promise<ProviderConsumersResponse> {
  const res = await fetch(`${API_BASE}/api/providers/${providerId}/consumers`);
  if (!res.ok) throw new Error("Failed to fetch provider consumers");
  return res.json();
}

export async function updateProvider(
  providerId: string,
  updates: { ratePerSecond?: number; description?: string; category?: string }
): Promise<ProviderListing> {
  const res = await fetch(`${API_BASE}/api/providers/${providerId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update provider");
  return res.json();
}

export async function deleteProvider(
  providerId: string
): Promise<{ deleted: boolean; providerId: string }> {
  const res = await fetch(`${API_BASE}/api/providers/${providerId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete provider");
  return res.json();
}

// ============================================================
//  Provider Withdrawal API
// ============================================================

export interface ProviderStream {
  streamId: string;
  agentId: string;
  agentName: string;
  agentPurpose: string;
  endpoint: string;
  ratePerSecondMist: number;
  durationSeconds: number;
  openedAt: string;
  depositMist: number;
  onChainBalanceMist: number;
  onChainBalanceSui: number;
  claimableMist: number;
  claimableSui: number;
  sender: string;
  recipient: string;
  lastWithdrawalMs: number;
  status: 'streaming' | 'depleted';
  chainError: string | null;
}

export interface ProviderStreamsResponse {
  providerId: string;
  providerAddress: string;
  totalStreams: number;
  totalClaimableMist: number;
  totalClaimableSui: number;
  totalOnChainBalanceMist: number;
  totalOnChainBalanceSui: number;
  streams: ProviderStream[];
}

export async function getProviderStreams(
  providerId: string
): Promise<ProviderStreamsResponse> {
  const res = await fetch(`${API_BASE}/api/providers/${providerId}/streams`);
  if (!res.ok) throw new Error("Failed to fetch provider streams");
  return res.json();
}

// ============================================================
//  Stream API
// ============================================================

export async function getStreamBalance(streamId: string): Promise<StreamBalance> {
  const res = await fetch(`${API_BASE}/api/streams/${streamId}/balance`);
  if (!res.ok) throw new Error("Stream not found");
  return res.json();
}

// ============================================================
//  Health API
// ============================================================

export async function getHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}
