# IBRL Sovereign Vault

**Sovereign, intent-driven execution on Solana (simulate-first + explicit user approval)**

IBRL is a Next.js dashboard + server-side intent engine. You type a high-level intent in plain English, the agent proposes a concrete Solana transaction, simulates it, and then asks you to approve/sign in your wallet before anything is broadcast.

Built for the Solana AI Agent Hackathon | Team: IBRL-agent's Team

## 🎯 Project Overview

IBRL turns natural language into strict, policy-gated actions:

- *"Swap 0.1 SOL to USDC"*
- *"Swap 10 USDC to SOL"*
- *"Exit 0.25 SOL to USDC"*
- *"Protect 0.25 SOL if SOL drops below 95"* (automation)
- *"Buy SOL with 25 USDC if SOL drops below 90"* (automation)
- *"DCA 5 USDC to SOL every 1h"* (automation)
- *"Given my balances, suggest a conservative/balanced/aggressive strategy"* (portfolio Q&A)
- *"Swap 0.1 SOL to USD"* (normalized to USDC)

All execution is **simulate-first** and **user-signed**. If the wallet prompt is rejected, the pending transaction is cancelled.

## ✅ Current Capabilities

- **Human-agent handshake (non-custodial):** wallet adapter connection + user signatures for all broadcasts.
- **Secure RPC proxy:** browser JSON-RPC calls route through `POST /api/rpc` (same-origin) so vendor RPC keys never ship to the client.
- **RPC failover:** configure multiple upstream RPCs via `SOLANA_RPC_URLS` (comma-separated) and the proxy retries on `403/429/5xx`.
- **SOL/USD monitoring:** server-side SOL price via Pyth Hermes (`GET /api/price`), cached.
- **Intent parsing + policy gate:** local parser for common intents + optional Gemini structured extraction (server-side only).
- **Real transaction simulation:** builds a real Jupiter swap transaction and runs on-chain simulation before asking for approval.
- **SQLite-backed autonomy:** save automations (price triggers + DCA) and run monitoring loops that create **approval-gated proposals** (no auto-broadcast).
- **Approvals Inbox (`/inbox`):** full list + details view, approve/deny actions, and a decision report per proposal.
- **Agent decision reports:** each proposal includes why/risks/scenarios + simulation and quote metadata.
- **Portfolio Q&A:** ask questions like a fund manager would; IBRL replies using your real on-chain SOL/USDC balances and live SOL/USD (if available). No auto-trades.

## 🧱 Architecture (high-level)

- **UI:** `src/components/DashboardCore.tsx`
- **Wallet provider:** `src/components/WalletContextProvider.tsx` (points wallet adapter to same-origin `/api/rpc`)
- **Intent API:** `src/app/api/intent/route.ts` (parse → policy → Jupiter quote → (optional) build+simulate)
- **RPC proxy:** `src/app/api/rpc/route.ts` (server-side forward + failover)
- **Price oracle:** `src/app/api/price/route.ts` (Pyth Hermes, cached)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A Solana wallet (Phantom/Solflare/etc)
- An upstream Solana RPC URL (kept in `.env`, server-side)

### Installation

1. Clone and install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Required environment variables (server-side):
```env
SOLANA_RPC_URL=...
# or SOLANA_RPC_URLS=..., ..., ...   (comma-separated failover list)
GEMINI_API_KEY=...                  # optional (server-side only)
SQLITE_PATH=.local/ibrl.sqlite      # local DB file (do not commit)
```

Notes:
- Do **not** put vendor RPC keys in `NEXT_PUBLIC_*`.
- Lock RPC provider keys to allowed origins + rate limits in the provider dashboard.
- The SQLite database is a local file; keep it out of git (this repo ignores `.local/` and `*.sqlite*`).

### Running the Application

1. **Start the web dashboard**:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

2. **(Optional) Start the background agent heartbeat**:
```bash
npm run start:agent
```
This process performs monitoring and evaluates saved automations. It generates **pending proposals** in SQLite when triggers fire, but it does not auto-broadcast: the user must still approve/sign in-wallet.

## 📡 API Endpoints

### GET /api/status
Returns real-time agent status and network statistics:
```json
{
  "riskLevel": "OPTIMAL",
  "currentEpoch": 1234,
  "solPrice": 98.42,
  "walletAddress": "...",
  "balance": 1.234,
  "uptime": "2H 30M",
  "lastUpdate": "2026-02-04T12:00:00.000Z",
  "startTime": 1738665600000
}
```

### POST /api/intent
Parse an intent into a policy-gated plan. With `execute=true`, the server builds + simulates a real Jupiter swap transaction (no broadcast). The UI then asks the user to approve/sign before sending:
```bash
curl -X POST http://localhost:3000/api/intent \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Swap 0.1 SOL to USDC"}'
```

Response (shape simplified):
```json
{
  "intent": { "kind": "SWAP", "from": "SOL", "to": "USDC", "amount": { "value": 0.1, "unit": "SOL" }, "slippageBps": 50 },
  "plan": [ "Quote via Jupiter", "Build + simulate transaction (optional)" ],
  "quote": { "...": "..." },
  "tx": { "swapTransactionBase64": "...", "simulation": { "...": "..." } },
  "agentReply": "Proposed swap. Simulate-first; approve in wallet to broadcast."
}
```

### GET /api/autonomy
Runs monitoring loops for an owner and evaluates saved automations. Generates **pending proposals** in SQLite when a trigger fires (still requires wallet approval to broadcast).

### GET /api/proposals (and /api/proposals/:id)
Lists proposals for an owner (pending/sent/denied) and returns proposal details, including the decision report and the base64 transaction (if applicable).

## 🔒 Security Considerations

- **Non-custodial execution:** user wallet signs and broadcasts transactions.
- **No vendor keys in the browser:** RPC keys stay in `.env` and are used server-side by `/api/rpc`.
- **Simulate-first:** agent simulates before asking for approval (still not a guarantee of final execution conditions).
- **Strict allowlist:** only supported intents are permitted; everything else is rejected.

## 🛣️ Roadmap

- [ ] Expand intent allowlist (with policy constraints)
- [ ] Slippage + size governance controls
- [ ] Protocol adapters beyond Jupiter (behind audits/policies)
- [ ] Structured risk monitoring + alerting
- [ ] Historical intent + execution logs

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

**© 2026 IBRL SOVEREIGN SYSTEMS** | Built for Solana AI Agent Hackathon
