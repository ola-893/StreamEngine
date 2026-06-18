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

export async function createAgent(params: {
  name: string;
  description?: string;
  purpose: string;
  budgetMist: number;
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

export async function listAgents(): Promise<BackendAgent[]> {
  const res = await fetch(`${API_BASE}/api/agents`);
  if (!res.ok) throw new Error("Failed to list agents");
  return res.json();
}

export async function getAgent(id: string): Promise<BackendAgent> {
  const res = await fetch(`${API_BASE}/api/agents/${id}`);
  if (!res.ok) throw new Error("Agent not found");
  return res.json();
}

export async function getAgentBalance(id: string): Promise<AgentBalance> {
  const res = await fetch(`${API_BASE}/api/agents/${id}/balance`);
  if (!res.ok) throw new Error("Failed to fetch agent balance");
  return res.json();
}

export async function listAgentStreams(id: string): Promise<AgentStreamsResponse> {
  const res = await fetch(`${API_BASE}/api/agents/${id}/streams`);
  if (!res.ok) throw new Error("Failed to list agent streams");
  return res.json();
}

export async function closeAgentStream(
  agentId: string,
  streamId: string
): Promise<CloseStreamResponse> {
  const res = await fetch(
    `${API_BASE}/api/agents/${agentId}/streams/${streamId}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error("Failed to close stream");
  return res.json();
}

export async function startAgent(
  agentId: string
): Promise<StartResponse> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || err.message || "Failed to start agent");
  }
  return res.json();
}

export async function accessEndpoint(
  agentId: string,
  endpoint: string
): Promise<AccessResponse> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}/access`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to access endpoint");
  }
  return res.json();
}

export async function fundAgent(
  agentId: string,
  amountMist: number
): Promise<FundResponse> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}/fund-demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amountMist }),
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
  streamId: string
): Promise<StreamState> {
  const res = await fetch(
    `${API_BASE}/api/agents/${agentId}/streams/${streamId}/state`
  );
  if (!res.ok) throw new Error("Failed to get stream state");
  return res.json();
}

export async function fetchStreamData(
  agentId: string,
  streamId: string
): Promise<FetchDataResponse> {
  const res = await fetch(
    `${API_BASE}/api/agents/${agentId}/streams/${streamId}/fetch-data`,
    { method: "POST", headers: { "Content-Type": "application/json" } }
  );
  if (!res.ok) throw new Error("Failed to fetch stream data");
  return res.json();
}

export interface DeleteAgentResponse {
  deleted: boolean;
  agentId: string;
}

export async function deleteAgent(agentId: string): Promise<DeleteAgentResponse> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}`, {
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

export async function listProviders(): Promise<{ providers: ProviderListing[] }> {
  const res = await fetch(`${API_BASE}/api/providers`);
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
