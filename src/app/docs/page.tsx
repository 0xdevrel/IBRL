import Link from 'next/link';

export default function DocsPage() {
  return (
    <div className="min-h-screen mosaic-bg px-4 pb-16 pt-10 md:px-10">
      <header className="mx-auto max-w-6xl">
        <div className="hairline-b flex items-center justify-between py-6">
          <div>
            <div className="tech-label text-[rgba(58,58,56,0.7)]">Documentation</div>
            <div className="tech-meta ink-dim">System blueprint • Protocol notes • API usage</div>
          </div>
          <Link
            href="/"
            className="inline-flex h-11 min-w-[220px] items-center justify-center rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-transparent px-6 tech-button ink-dim hover:text-[var(--color-forest)]"
          >
            00. Back
          </Link>
        </div>
      </header>

      <main className="mx-auto mt-10 max-w-6xl">
        <div className="grid grid-cols-1 gap-px rounded-[2px] bg-[rgba(58,58,56,0.2)] md:grid-cols-12">
          <section className="md:col-span-7 bg-[var(--color-paper)] p-8">
            <h1 className="font-sans text-[56px] leading-[0.9] tracking-tight text-[var(--color-forest)] md:text-[82px]">
              System Notes
            </h1>
            <div className="mt-6 flex items-start gap-4">
              <div className="mt-1 h-10 w-px bg-[rgba(58,58,56,0.2)]" />
              <p className="tech-meta ink-dim max-w-xl">
                IBRL is a Next.js dashboard + server-side agent prototype. The UI parses natural-language intents into an
                execution plan and can optionally execute steps using a server-side signer.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-3">
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
                  <span className="font-mono">POST /api/intent</span> parses a prompt into strategy steps and can execute when{' '}
                  <span className="font-mono">execute=true</span>. Execution uses a server-side signer loaded from{' '}
                  <span className="font-mono">AGENT_PRIVATE_KEY</span>.
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
                    <span className="font-mono">/api/price</span> — SOL price (cached)
                  </div>
                  <div>
                    <span className="font-mono">/api/rpc</span> — secure JSON-RPC proxy
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
                    <span className="font-mono">AGENT_PRIVATE_KEY</span> — server-side signer
                  </div>
                  <div>
                    <span className="font-mono">HACKATHON_API_KEY</span> — hackathon services
                  </div>
                </div>
              </div>
              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                <div className="tech-label ink-dim">03. Operator Notes</div>
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
