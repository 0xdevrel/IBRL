# IBRL Demo Video Runbook (Hackathon)

This document is a step-by-step script for recording a clear, judge-friendly demo of IBRL’s **simulate-first + approval-gated** intent engine, inbox, and autonomous loops.

## Recording Checklist (Before You Start)

- Record at **1080p** (or higher) with system audio on (optional).
- **Do not** show:
  - `.env` contents, RPC URLs, Gemini key, or any provider dashboards.
  - Wallet seed phrase / recovery phrase.
  - Any private browsing data.
- Use a wallet with a **small** amount of SOL (and optionally USDC) on **mainnet**.
- Close other noisy tabs/apps.

## One-Time Setup (On Camera Optional)

1. Install deps:
   - `npm install`
2. Configure env:
   - `cp .env.example .env`
   - Set `SOLANA_RPC_URL` (or `SOLANA_RPC_URLS`), and optionally `GEMINI_API_KEY`.
   - Ensure `SQLITE_PATH` points to a local file (default: `.local/ibrl.sqlite`).

Notes:
- RPC keys must stay server-side only (never `NEXT_PUBLIC_*`).
- SQLite lives under `.local/` and is ignored by git.

## Demo Flow (Recommended Order)

### 1) Start the app + show the architecture boundary

In two terminals:

1. Web app:
   - `npm run dev`
2. Agent loop (autonomy heartbeat):
   - `npm run start:agent`

Say out loud:
- “The agent never auto-broadcasts transactions. It only **proposes** and **simulates**, then the user approves in-wallet.”

### 2) Open the Dashboard and connect wallet

1. Open `http://localhost:3000`
2. Click **Select Wallet**
3. Connect Phantom (or another wallet)

What to point out:
- SOL price, epoch, and wallet balance populate.
- This is **mainnet** data.

### 3) Parse → Simulate (no broadcast) → Approve gate

Use templates (recommended):

1. Click template: **Swap 0.1 SOL → USDC** (or type `Swap 0.01 SOL to USDC`).
2. Click **Parse**
   - Point out that parsing is fast and the agent produces a structured plan.
3. Click **Simulate**
   - Point out “Simulation OK/ERR” appears.
4. Click **Approve & Send**
   - Approve in wallet to broadcast **OR** reject to demonstrate cancellation.

If you reject:
- Point out the UI shows cancellation (and the proposal is marked denied).

### 4) Inbox: full approvals list + decision reports

1. Go to `/inbox` using the nav
2. Click any proposal

What to show:
- Status: Pending / Sent / Denied
- **Decision Report** content:
  - why this action
  - risks
  - simulation result
  - what changes if price moves

If you see “stale proposal”:
- Click **Rebuild** to fetch a fresh quote + rebuild + simulate a new transaction (still no broadcast).

If your inbox is empty:
- Click **Generate Sample Proposal**
  - This builds and simulates a real Jupiter swap and creates a real pending proposal (still no broadcast until approved).

### 5) Portfolio Q&A (Markdown responses)

Back on the dashboard terminal:

1. Click template: **Strategy (3 modes)**
2. Click **Parse**

What to show:
- The response uses your **real on-chain balances** and renders Markdown (headings, bullets).
- Make clear this intent produces **advice only**, not transactions.

### 6) Save an automation and show autonomy creating proposals

Goal: show a proposal appears **even if the UI is closed**, but still requires approval.

1. On the dashboard, enter:
   - `Protect 0.05 SOL if SOL drops below 10000`
     - (This threshold is intentionally high so it triggers immediately for demo.)
2. Click **Parse**
3. Click **Save Automation**

Now demonstrate autonomy:

1. Close the browser tab (optional but recommended)
2. Confirm the agent loop is running in terminal (`npm run start:agent`)
3. Re-open the app and go to:
   - `/activity`
   - `/inbox`

What to show:
- A new **auto-triggered** proposal exists (created by `agent`).
- It has a decision report and is **PENDING_APPROVAL** until you approve/sign in-wallet.
- Decision report now includes a **route breakdown** (hop count + venues) from Jupiter’s `routePlan`.

Optional: demonstrate a second autonomous loop (“buffer rebalance”)

- If your wallet has meaningful SOL but very low USDC, the agent may propose:
  - `Auto-buffer: exit 0.02–0.05 SOL → USDC`
- Show it appears as a proposal (still approval-gated) and explain the “why” in the report.

Optional: demonstrate a third autonomous loop (“volatility spike”)

- Leave `npm run start:agent` running for a few minutes so it collects `price_samples`.
- If SOL price is choppy, the agent may propose:
  - `Auto-volatility: reduce risk by exiting X SOL → USDC (σ≈..., range ... / 30m)`
- In the decision report, call out:
  - “Trigger metric: σ≈… (range … / 30m, n=…)”

### 7) Activity Console: “Most Agentic” proof

Open `/activity`:

Show:
- latest SOL/USD sample time
- automations count
- pending approvals count
- recent proposals + reports
- interaction logs

Say out loud:
- “This page is a single-pane proof that the system monitors, proposes, explains, and waits for explicit approval.”

## Buttons / UX Items to Click (Checklist)

- Header nav: **Dashboard**, **Inbox**, **Activity**, **Documentation**, **Security**
- Wallet: **Select Wallet**, connect/disconnect
- Terminal: **Parse**, **Simulate**, **Approve & Send**, **Cancel**
- Inbox: select proposal, **Approve & Send**, **Deny**, **Generate Sample Proposal**

## Important Notes (Avoid Confusion in Demo)

- If you see “Insufficient USDC balance…”, it’s expected when trying an intent that needs USDC. The agent should report the real balance shortfall.
- Price triggers depend on current SOL/USD; for demos, use a high threshold (like `10000`) to trigger immediately.
- This repo does **not** implement a “open http://… in terminal and launch the system browser” command. If you want that as a demo feature, we can add it as a strictly non-custodial convenience action (no keys/secrets involved) in a follow-up.
