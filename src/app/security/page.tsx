import Link from 'next/link';

export default function SecurityPage() {
  return (
    <div className="min-h-screen mosaic-bg pb-16">
      <header className="sticky top-0 z-20 bg-[color:var(--color-paper)]/92 backdrop-blur-sm">
        <div className="hairline-b">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 md:px-10">
            <div>
              <div className="tech-label ink-strong">Security Audit</div>
              <div className="tech-meta ink-dim">Threat model • Controls • Open risks</div>
            </div>
            <Link
              href="/"
              className="inline-flex h-11 min-w-[180px] items-center justify-center rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-[var(--color-forest)] px-6 tech-button text-[var(--color-paper)] hover:opacity-90 transition-opacity duration-150 ease-out"
            >
              00. Back
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-10 max-w-6xl px-4 md:px-10">
        <div className="grid grid-cols-1 gap-px rounded-[2px] bg-[rgba(58,58,56,0.2)] md:grid-cols-12">
          <section className="md:col-span-8 bg-[var(--color-paper)] p-8">
            <h1 className="font-sans text-[56px] leading-[0.9] tracking-tight text-[var(--color-forest)] md:text-[82px]">
              Security Model
            </h1>
            <div className="mt-6 flex items-start gap-4">
              <div className="mt-1 h-10 w-px bg-[rgba(58,58,56,0.2)]" />
              <p className="tech-meta ink-dim max-w-2xl">
                IBRL is non-custodial: the user’s wallet signs and broadcasts transactions. The server proposes actions,
                builds transactions for simulation, and provides a same-origin RPC proxy to keep vendor RPC keys out of the
                browser.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-3">
              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-6">
                <div className="tech-label ink-dim">Signing Boundary</div>
                <div className="mt-3 text-[12px] leading-6 ink-dim">
                  The server never receives user private keys. Any on-chain state change requires an explicit wallet
                  signature. If the user rejects the wallet prompt, execution is cancelled.
                </div>
              </div>

              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-6">
                <div className="tech-label ink-dim">Simulate-First</div>
                <div className="mt-3 text-[12px] leading-6 ink-dim">
                  The agent builds a real Jupiter transaction and runs RPC simulation before asking the user to sign. This
                  catches account issues and reduces surprises, but does not guarantee final execution conditions.
                </div>
              </div>

              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-6">
                <div className="tech-label ink-dim">Secret Handling</div>
                <div className="mt-3 text-[12px] leading-6 ink-dim">
                  RPC vendor URLs/keys and <span className="font-mono">GEMINI_API_KEY</span> live in{' '}
                  <span className="font-mono">.env</span> only and are read server-side. Never put them in{' '}
                  <span className="font-mono">NEXT_PUBLIC_*</span>.
                </div>
              </div>
            </div>
          </section>

          <section className="md:col-span-4 bg-[var(--color-paper)] p-8">
            <div className="tech-label ink-dim">Controls &amp; Risks</div>
            <div className="mt-6 space-y-3">
              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                <div className="tech-label ink-dim">Server RPC Proxy</div>
                <div className="mt-2 text-[12px] leading-6 ink-dim">
                  Browser never sees vendor RPC keys; all JSON-RPC routes through <span className="font-mono">/api/rpc</span>.
                </div>
              </div>
              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                <div className="tech-label ink-dim">Failover</div>
                <div className="mt-2 text-[12px] leading-6 ink-dim">
                  Supports upstream retry on <span className="font-mono">403/429/5xx</span> via{' '}
                  <span className="font-mono">SOLANA_RPC_URLS</span>.
                </div>
              </div>
              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                <div className="tech-label ink-dim">Open Risks</div>
                <div className="mt-2 space-y-2 text-[12px] leading-6 ink-dim">
                  <div>
                    <span className="font-mono">LLM output</span> — mitigated by strict schema + policy allowlist.
                  </div>
                  <div>
                    <span className="font-mono">Execution drift</span> — prices/fees can change after simulation.
                  </div>
                  <div>
                    <span className="font-mono">RPC limits</span> — upstream providers may rate limit or forbid requests.
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
