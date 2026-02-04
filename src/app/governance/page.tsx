import Link from 'next/link';

export default function GovernancePage() {
  return (
    <div className="min-h-screen mosaic-bg pb-16">
      <header className="sticky top-0 z-20 bg-[color:var(--color-paper)]/92 backdrop-blur-sm">
        <div className="hairline-b">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 md:px-10">
            <div>
              <div className="tech-label ink-strong">Governance</div>
              <div className="tech-meta ink-dim">Parameters • Risk policy • Future proposals</div>
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
          <section className="md:col-span-6 bg-[var(--color-paper)] p-8">
            <h1 className="font-sans text-[56px] leading-[0.9] tracking-tight text-[var(--color-forest)] md:text-[82px]">
              Policy Surface
            </h1>
            <div className="mt-6 flex items-start gap-4">
              <div className="mt-1 h-10 w-px bg-[rgba(58,58,56,0.2)]" />
              <p className="tech-meta ink-dim max-w-xl">
                The “sovereign” property comes from a strict policy boundary: only allow actions that are understood,
                simulated, and explicitly approved by the user. Governance will eventually control what strategies are
                allowed and under which limits.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-3">
              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-6">
                <div className="tech-label ink-dim">Current Allowlist</div>
                <div className="mt-3 space-y-2 text-[12px] leading-6 ink-dim">
                  <div>
                    <span className="font-mono">Swap X SOL → USDC</span> (Jupiter, simulate-first)
                  </div>
                  <div>
                    <span className="font-mono">Exit X SOL → USDC</span> (same route, safety synonym)
                  </div>
                </div>
              </div>
              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-6">
                <div className="tech-label ink-dim">Execution Rules</div>
                <div className="mt-3 text-[12px] leading-6 ink-dim">
                  All transactions are simulated server-side and must be signed by the user’s wallet. The agent never
                  auto-broadcasts without an explicit approval.
                </div>
              </div>
            </div>
          </section>

          <section className="md:col-span-6 bg-[var(--color-paper)] p-8">
            <div className="tech-label ink-dim">Future Governance Modules</div>
            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                <div className="tech-label ink-dim">Risk Params</div>
                <div className="mt-2 text-[12px] leading-6 ink-dim">
                  Max amount, slippage caps, and drawdown limits per intent category.
                </div>
              </div>
              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                <div className="tech-label ink-dim">Strategy Allowlist</div>
                <div className="mt-2 text-[12px] leading-6 ink-dim">
                  Protocol integrations (Kamino, etc.) behind explicit, audited constraints.
                </div>
              </div>
              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                <div className="tech-label ink-dim">Emergency Exit</div>
                <div className="mt-2 text-[12px] leading-6 ink-dim">
                  Verified unwind playbooks with simulation + explicit user confirmation.
                </div>
              </div>
              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                <div className="tech-label ink-dim">Proposals</div>
                <div className="mt-2 text-[12px] leading-6 ink-dim">
                  Change log, policy diffs, and upgrade workflow for strategy expansions.
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
