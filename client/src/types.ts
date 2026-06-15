/** @license SPDX-License-Identifier: Apache-2.0 */

const API_BASE = "http://localhost:3001";

export { API_BASE };

export type EndpointType = "stream" | "compute" | "api";
export type EndpointStatus = "active" | "synced" | "degraded" | "offline";

export interface Endpoint {
  id: string;
  name: string;
  type: EndpointType;
  status: EndpointStatus;
  price: number;
  unit: string;
  dataProvider: string;
  latency: number;
  throughput: string;
  rating: number;
  uptime: number;
  description: string;
  endpointUrl: string;
  inputs: string[];
  outputs: string[];
  apiKeyRequired: boolean;
  totalRequests: number;
  activeConsumers: number;
  gasSui: number;
  hardwareSpecs?: string;
  location?: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  purpose: string;
  selectedEndpoints: string[];
  maxBudgetSui: number;
  currentSpendSui: number;
  autoRefill: boolean;
  scrapeInterval: string;
  status: "active" | "paused" | "depleted";
  createdAt: string;
  totalRequests: number;
}

// Backend API response types
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

export interface StreamBalance {
  streamId: string;
  balanceMist: number;
  balanceSui: number;
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

// Shared mapping: backend ProviderListing → frontend Endpoint
export function mapProviderToEndpoint(p: ProviderListing): Endpoint {
  return {
    id: p.id,
    name: p.name.toUpperCase().replace(/\s+/g, "_"),
    type: (p.category === "Social Media" ? "api" : p.category === "Finance" ? "api" : "stream") as Endpoint["type"],
    status: "active",
    price: p.ratePerSecond / 1_000_000_000,
    unit: "sec of access",
    dataProvider: p.name,
    latency: 12,
    throughput: "42.4 MB/s",
    rating: 4.95,
    uptime: 99.99,
    description: p.description,
    endpointUrl: p.websiteUrl,
    inputs: ["request_body"],
    outputs: ["stream_chunk"],
    apiKeyRequired: false,
    totalRequests: 0,
    activeConsumers: 0,
    gasSui: 0.002,
  };
}
