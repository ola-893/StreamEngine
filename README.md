# FlowGate - Money Streaming SDK for AI Agents

> 402 payment rails for autonomous agents on Sui. Any platform can plug in.

## The Problem

AI agents need to pay for services - data, APIs, compute, other agents. 
Current options: credit cards (require KYC), crypto wallets (require human 
approval per transaction), monthly subscriptions (not granular enough).

None of these work for autonomous agents operating at machine speed.

## What FlowGate Does

FlowGate is an SDK that gives AI agents their own wallets and lets them 
stream SUI micropayments per second of service access - automatically, 
trustlessly, with no human in the loop.

- Agent hits a service endpoint -> gets HTTP 402 Payment Required
- SDK intercepts, creates a StreamObject on Sui, retries
- Service verifies stream balance on-chain -> grants access
- Stream steps -> access revoked instantly

No invoices. No billing cycles. No trust required on either side.

## Demo: Website Scraping Marketplace

To make the protocol concrete, we built a marketplace where website owners 
list their sites at a price-per-record. AI agents discover listings, open 
payment streams, and get scraping access. The moment a stream closes, 
access is revoked.

This is one use case. The core SDK works for any service that wants to 
charge AI agents per second of access.

## SDK - Any Platform Can Plug In

```typescript
import { SuiDataGateSDK } from '@flowgate/sdk';

const agent = new SuiDataGateSDK({ privateKey: agentPrivateKey });

// Automatically handles 402 -> stream creation + retry
const data = await agent.makeRequest('https://yourservice.com/premium/feed');
```

## Architecture

```
[AI Agent]
   |
   |-- POST /api/agents { ownerAddress } -> FlowGate creates an owner-scoped agent wallet
   |
   |-- Hits service endpoint -> 402 Payment Required
   |
   |-- SDK creates StreamObject on Sui (PTB, signed by agent wallet)
   |
   |-- Service middleware reads StreamObject balance on-chain
   |
   |-- Balance > 0 -> access granted
   |-- Balance = 0 -> 402 again, access revoked
```

## Agent Owner Isolation

Each connected wallet registers and controls its own independent agent. Agent records, balances, streams, and controls are scoped by `ownerAddress`; one visitor cannot list, inspect, start, stop, fund, withdraw from, or delete another wallet's agent.

## Why Sui

- Sub-second finality (~400ms) - real-time stream verification
- ~$0.001 fees - micro-transactions are economically viable
- Object model - StreamObject is a first-class on-chain asset
- PTBs - agent bundles wallet creation + stream creation atomically

## Deployed Contract

```
Package: 0xb05b3964df8b88a86cda6b192893399966014af9dd6fc6beb26f1343a0495495
Network: Sui Testnet
Module:  stream_engine::stream
```

## Quick Start

```bash
docker compose up --build
# Server + client + SQLite persistence - one command
# Open http://localhost
```

## Roadmap

- **zkLogin integration** - threshold encryption to hide stream participants
- **agent to agent streaming** - agents paying other agents directly
- **USDC support** - stablecoin streams for production use
