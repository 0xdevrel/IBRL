import Link from 'next/link';

export default function DocsPage() {
  return (
    <div className="min-h-screen mosaic-bg pb-16">
      <header className="sticky top-0 z-20 bg-[color:var(--color-paper)]/92 backdrop-blur-sm">
        <div className="hairline-b">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 md:px-10">
            <div>
              <div className="tech-label ink-strong">Documentation</div>
              <div className="tech-meta ink-dim">System blueprint • Operator notes • API usage</div>
            </div>
            <Link
              href="/"
              className="inline-flex h-11 min-w-[220px] items-center justify-center rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-[var(--color-forest)] px-6 tech-button text-[var(--color-paper)] hover:opacity-90 transition-opacity duration-150 ease-out"
            >
              00. Back
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-10 max-w-6xl px-4 md:px-10">
        <div className="grid grid-cols-1 gap-px rounded-[2px] bg-[rgba(58,58,56,0.2)] md:grid-cols-12">
          <section className="md:col-span-7 bg-[var(--color-paper)] p-8">
            <h1 className="font-sans text-[56px] leading-[0.9] tracking-tight text-[var(--color-forest)] md:text-[82px]">
              System Notes
            </h1>
            <div className="mt-6 flex items-start gap-4">
              <div className="mt-1 h-10 w-px bg-[rgba(58,58,56,0.2)]" />
              <p className="tech-meta ink-dim max-w-xl">
                IBRL is a Next.js dashboard + server-side intent engine. The agent proposes actions, simulates them via RPC,
                then asks the user to approve and sign in their wallet before any transaction is broadcast.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-3">
              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-6">
                <div className="tech-label ink-dim">Current Capabilities</div>
                <div className="mt-3 space-y-2 text-[12px] leading-6 ink-dim">
                  <div>
                    <span className="font-mono">Intent → plan</span> with strict schema + policy gate (local parser + optional
                    Gemini extraction).
                  </div>
                  <div>
                    <span className="font-mono">Portfolio Q&amp;A</span>: ask for strategy guidance; the agent replies from
                    your real on-chain balances (no auto-trades).
                  </div>
                  <div>
                    <span className="font-mono">Jupiter swaps</span> for <span className="font-mono">SOL → USDC</span>{' '}
                    (simulate-first, then wallet approval to broadcast).
                  </div>
                  <div>
                    <span className="font-mono">USDC → SOL swaps</span> are supported (requires a USDC token balance).
                  </div>
                  <div>
                    <span className="font-mono">Secure RPC proxy</span> + upstream failover to avoid browser 403s and keep
                    vendor keys server-side.
                  </div>
                  <div>
                    <span className="font-mono">SQLite proposals store</span>: simulations + pending approvals and saved
                    automations are persisted locally (not committed to git).
                  </div>
                  <div>
                    <span className="font-mono">Monitoring</span>: SOL/USD (Pyth Hermes), epoch info, wallet balance.
                  </div>
                  <div>
                    <span className="font-mono">Operator UX</span>: an approvals inbox and intent templates reduce friction
                    while keeping wallet approval as the execution boundary. Each proposal includes a decision report.
                  </div>
                </div>
              </div>

              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-6">
                <div className="tech-label ink-dim">How To Use</div>
                <div className="mt-3 text-[12px] leading-6 ink-dim">
                  01. Connect a wallet → 02. Parse an intent → 03. Simulate (server builds + simulates a real Jupiter
                  transaction) → 04. Approve &amp; Send (wallet signs + broadcasts). If you reject in-wallet, the pending
                  transaction is cancelled.
                </div>
              </div>

              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-6">
                <div className="tech-label ink-dim">Secure RPC Proxy</div>
                <div className="mt-3 text-[12px] leading-6 ink-dim">
                  Browser JSON-RPC calls route through <span className="font-mono">POST /api/rpc</span>, which forwards to
                  your upstream <span className="font-mono">SOLANA_RPC_URL</span> / <span className="font-mono">SOLANA_RPC_URLS</span>{' '}
                  server-side. This prevents exposing vendor keys in the client bundle and avoids browser-origin 403s.
                </div>
              </div>

              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-6">
                <div className="tech-label ink-dim">Upstream Failover</div>
                <div className="mt-3 text-[12px] leading-6 ink-dim">
                  Configure <span className="font-mono">SOLANA_RPC_URLS</span> as a comma-separated list. The proxy retries
                  the next upstream on <span className="font-mono">403</span>, <span className="font-mono">429</span>, or{' '}
                  <span className="font-mono">5xx</span> responses.
                </div>
              </div>

              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-6">
                <div className="tech-label ink-dim">Price Feed (UI)</div>
                <div className="mt-3 text-[12px] leading-6 ink-dim">
                  The dashboard uses <span className="font-mono">GET /api/price</span> (server-side, cached) to display SOL
                  price and avoid third-party auth/CORS issues in the browser.
                </div>
              </div>

              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-6">
                <div className="tech-label ink-dim">Wallet Connectivity</div>
                <div className="mt-3 text-[12px] leading-6 ink-dim">
                  Uses Wallet Standard auto-detection (Phantom/Solflare/etc). The connection endpoint is set to the same-origin
                  proxy so the wallet adapter never calls vendor RPC URLs directly from the browser.
                </div>
              </div>

              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-6">
                <div className="tech-label ink-dim">Intent API</div>
                <div className="mt-3 text-[12px] leading-6 ink-dim">
                  <span className="font-mono">POST /api/intent</span> extracts a strict JSON intent (local parser + optional
                  Gemini <span className="font-mono">gemini-3-flash-preview</span>), applies a policy gate, then builds a
                  Jupiter transaction for simulation. If simulation is OK, the UI asks the user to approve and sign the
                  transaction in their wallet before broadcast.
                </div>
              </div>
            </div>
          </section>

          <section className="md:col-span-5 bg-[var(--color-paper)] p-8">
            <div className="tech-label ink-dim">Contents</div>
            <div className="mt-6 space-y-3">
              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                <div className="tech-label ink-dim">01. Endpoints</div>
                <div className="mt-2 space-y-2 text-[12px] leading-6 ink-dim">
                  <div>
                    <span className="font-mono">/api/status</span> — agent status snapshot
                  </div>
                  <div>
                    <span className="font-mono">/api/intent</span> — parse/execute intents
                  </div>
                  <div>
                    <span className="font-mono">/api/autonomy</span> — monitoring loops + automation evaluation (approval-gated proposals)
                  </div>
                  <div>
                    <span className="font-mono">/api/activity</span> — recent proposals + logs + monitoring samples (per wallet)
                  </div>
                  <div>
                    <span className="font-mono">/api/intents</span> — save/list automations (SQLite)
                  </div>
                  <div>
                    <span className="font-mono">/api/approvals</span> — list pending proposals (SQLite)
                  </div>
                  <div>
                    <span className="font-mono">/api/proposals</span> — full proposals inbox (filters + detail)
                  </div>
                  <div>
                    <span className="font-mono">/api/proposals/:id/refresh</span> — rebuild + re-simulate a pending proposal
                  </div>
                  <div>
                    <span className="font-mono">/api/price</span> — SOL price (cached)
                  </div>
                  <div>
                    <span className="font-mono">/api/rpc</span> — secure JSON-RPC proxy
                  </div>
                  <div>
                    <span className="font-mono">/inbox</span> — approvals inbox UI
                  </div>
                  <div>
                    <span className="font-mono">/activity</span> — activity console UI (monitoring + logs)
                  </div>
                </div>
              </div>
              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                <div className="tech-label ink-dim">02. Environment</div>
                <div className="mt-2 space-y-2 text-[12px] leading-6 ink-dim">
                  <div>
                    <span className="font-mono">SOLANA_RPC_URL</span> / <span className="font-mono">SOLANA_RPC_URLS</span> — upstream RPC(s)
                  </div>
                  <div>
                    <span className="font-mono">GEMINI_API_KEY</span> — server-side intent extraction (never sent to browser)
                  </div>
                  <div>
                    <span className="font-mono">SQLITE_PATH</span> — local DB file for proposals + automations (server-side)
                  </div>
                  <div>
                    <span className="font-mono">HACKATHON_API_KEY</span> — hackathon services
                  </div>
                </div>
              </div>
              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                <div className="tech-label ink-dim">03. Supported Intents</div>
                <div className="mt-2 space-y-2 text-[12px] leading-6 ink-dim">
                  <div>
                    <span className="font-mono">Swap X SOL to USDC</span>
                  </div>
                  <div>
                    <span className="font-mono">Swap X USDC to SOL</span>
                  </div>
                  <div>
                    <span className="font-mono">Exit X SOL to USDC</span>
                  </div>
                  <div>
                    <span className="font-mono">Protect X SOL if SOL drops below Y</span> (save automation)
                  </div>
                  <div>
                    <span className="font-mono">Buy SOL with X USDC if SOL drops below Y</span> (save automation)
                  </div>
                  <div>
                    <span className="font-mono">DCA X USDC to SOL every Nh</span> (save automation)
                  </div>
                  <div>
                    <span className="font-mono">Ask fund-manager questions</span> (portfolio Q&amp;A)
                  </div>
                  <div>
                    <span className="font-mono">Autonomous loops</span>: drawdown hedge + USDC buffer proposals (approval-gated)
                  </div>
                  <div>
                    <span className="font-mono">Volatility monitor</span>: realized-volatility spike → propose “reduce risk” exit (approval-gated)
                  </div>
                  <div className="text-[rgba(58,58,56,0.65)]">
                    More intents are intentionally gated behind strict policies.
                  </div>
                </div>
              </div>
              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                <div className="tech-label ink-dim">04. Known Limits</div>
                <div className="mt-2 space-y-2 text-[12px] leading-6 ink-dim">
                  <div>
                    Only <span className="font-mono">SOL</span> and <span className="font-mono">USDC</span> are supported in v1.
                  </div>
                  <div>
                    Execution always requires a wallet signature; the agent will not auto-broadcast.
                  </div>
                  <div>
                    Simulation reduces surprises but cannot freeze prices or guarantee final execution conditions.
                  </div>
                </div>
              </div>
              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                <div className="tech-label ink-dim">05. Operator Notes</div>
                <div className="mt-2 text-[12px] leading-6 ink-dim">
                  Keep vendor keys out of <span className="font-mono">NEXT_PUBLIC_*</span>. Route client RPC via the proxy and
                  lock provider keys to allowed domains + rate limits.
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
