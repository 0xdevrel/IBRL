# IBRL Sovereign Vault

**An autonomous, intent-driven sovereign agent vault on Solana**

IBRL allows users to provision capital to a dedicated agent proxy that manages risk and yield strategies using Jupiter and Kamino based on natural language commands.

Built for the Solana AI Agent Hackathon | Team: IBRL-agent's Team

## 🎯 Project Overview

IBRL Sovereign Vault is a cutting-edge DeFi protocol that combines AI-powered intent parsing with automated trading strategies on Solana. Users can interact with the vault using natural language commands like:

- *"Chase 10% APY on SOL but exit if it drops 5%"*
- *"Protect my position with stop-loss at $95"*
- *"Optimize yield on 0.5 SOL"*

The agent autonomously executes these intents using Jupiter for DEX aggregation and Kamino for yield strategies.

## 🏗️ Architecture

### Core Components

1. **IBRLAgent** (`src/agent/core.ts`)
   - Main agent orchestrator
   - Real-time SOL price tracking (Jupiter API + CoinGecko fallback)
   - Network stats monitoring (epochs, balances)
   - 30-second autonomous cycles

2. **IntentEngine** (`src/agent/strategy.ts`)
   - Natural language parser for trading commands
   - Strategy generation (ALLOCATE, PROTECT, HARVEST, EXIT)
   - Risk management logic

3. **JupiterManager** (`src/agent/jupiter.ts`)
   - DEX aggregation via Jupiter API v6
   - Optimal route discovery
   - Transaction execution

4. **AgentWallet** (`src/agent/wallet.ts`)
   - Secure key management
   - Transaction signing and broadcasting

5. **Dashboard** (`src/components/DashboardCore.tsx`)
   - Real-time UI with minimalist design
   - Live metrics and terminal interface
   - Wallet integration

### Technical Stack

- **Frontend**: Next.js 16.1.6, React 19.2.3, TypeScript
- **Styling**: TailwindCSS with custom minimalist theme
- **Blockchain**: Solana Web3.js, Anchor framework
- **DeFi**: Jupiter API v6, Kamino integration
- **Wallet**: Solana Wallet Adapter

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Solana wallet (for agent operations)
- Environment variables configured

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

3. Required environment variables:
```env
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
AGENT_PRIVATE_KEY=[1,2,3,4,5...] # JSON array format
HACKATHON_API_KEY=your_hackathon_api_key
NEXT_PUBLIC_SOLANA_RPC_URL=/api/rpc # Client RPC for wallet adapter (browser, proxied)
```

### Recommended RPCs (tested)

These RPCs responded successfully to `getEpochInfo` / `getLatestBlockhash` during local testing:
- Helius: `https://mainnet.helius-rpc.com/?api-key=...`
- Alchemy: `https://solana-mainnet.g.alchemy.com/v2/...`
- QuickNode: `https://*.solana-mainnet.quiknode.pro/...`

Set `NEXT_PUBLIC_SOLANA_RPC_URL` to one of the above so the dashboard + Phantom connect reliably. Treat provider keys as public (they ship to the browser) and lock them down using your provider’s domain allowlist and rate limits.

### Secure RPC (recommended)

The app includes a same-origin Solana JSON-RPC proxy at `POST /api/rpc` that forwards requests to `SOLANA_RPC_URL` server-side. Set `NEXT_PUBLIC_SOLANA_RPC_URL=/api/rpc` to:
- avoid browser-origin restrictions (often the root cause of `403 Access forbidden`)
- keep RPC provider keys out of the client bundle

### Running the Application

1. **Start the web dashboard**:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

2. **Start the autonomous agent**:
```bash
npm run start:agent
```

## 📡 API Endpoints

### GET /api/status
Returns real-time agent status and network statistics:
```json
{
  "startTime": 1738665600000,
  "totalValueLocked": 0,
  "activePositions": [],
  "riskLevel": "OPTIMAL",
  "currentEpoch": 1234,
  "solPrice": 98.42,
  "walletAddress": "...",
  "balance": 1.234,
  "uptime": "02:30:45",
  "lastUpdate": "2026-02-04T12:00:00.000Z"
}
```

### POST /api/intent
Parse natural language intent into execution plan:
```bash
curl -X POST http://localhost:3000/api/intent \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Chase 10% APY on SOL but exit if it drops 5%"}'
```

Response:
```json
{
  "prompt": "Chase 10% APY on SOL but exit if it drops 5%",
  "plan": [
    {
      "type": "ALLOCATE",
      "description": "Optimizing for maximum stablecoin yield via Kamino/Drift",
      "params": { "target": "USDC", "minApy": 0.08 },
      "status": "READY",
      "timestamp": 1738665600000
    },
    {
      "type": "PROTECT",
      "description": "Enabling dynamic stop-loss at 5% drawdown threshold",
      "params": { "threshold": 0.05, "asset": "SOL" },
      "status": "READY",
      "timestamp": 1738665600000
    }
  ],
  "timestamp": 1738665600000,
  "agentFingerprint": "IBRL-α-01"
}
```

## 🎨 UI Features

- **Real-time Metrics**: SOL price, epoch progress, wallet balance
- **Terminal Interface**: Intent engine with command input
- **Minimalist Design**: Technical aesthetic with forest (#1A3C2B) accents
- **Responsive Layout**: Mobile-friendly dashboard
- **Live Updates**: 5-second refresh cycles

## 🔒 Security Considerations

- Agent private key stored securely in environment variables
- All transactions simulated before execution
- Risk level monitoring and automatic safeguards
- Stop-loss mechanisms built into strategy execution

## 🛣️ Roadmap

- [ ] Full Kamino integration for yield strategies
- [ ] Advanced risk modeling
- [ ] Multi-asset support
- [ ] Governance token integration
- [ ] Historical performance tracking
- [ ] Mobile app

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
