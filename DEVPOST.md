# Devpost Copy

## What It Does

FlowGate gives each connected wallet its own isolated AI agent wallet. Agents are scoped per owner: a visitor can register, fund, start, stop, and inspect only the agent tied to their connected wallet, with no shared global agent state between judges or demo users.

Website owners list sites with a price per second of scraping access. AI agents discover those listings, receive a 402 Payment Required response, open a SUI payment stream, and gain access while the stream has balance. When the stream closes, access is revoked.

## Accomplishments

- Built real Sui testnet payment streams for website scraping access.
- Verified stream creation, access, close, and post-close 402 revocation with real transaction hashes.
- Added wallet-scoped agent isolation so simultaneous visitors cannot see or control another wallet's agent.
