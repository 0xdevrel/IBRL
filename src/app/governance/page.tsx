import Link from 'next/link';

export default function GovernancePage() {
  return (
    <div className="min-h-screen mosaic-bg px-4 pb-16 pt-10 md:px-10">
      <header className="mx-auto max-w-6xl">
        <div className="hairline-b flex items-center justify-between py-6">
          <div>
            <div className="tech-label ink-dim">Governance</div>
            <div className="tech-meta ink-dim">Parameters • Risk policy • Future proposals</div>
          </div>
          <Link
            href="/"
            className="inline-flex h-11 min-w-[180px] items-center justify-center rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-transparent px-6 tech-button ink-dim hover:text-[var(--color-forest)]"
          >
            00. Back
          </Link>
        </div>
      </header>

      <main className="mx-auto mt-10 max-w-6xl">
        <div className="grid grid-cols-1 gap-px rounded-[2px] bg-[rgba(58,58,56,0.2)] md:grid-cols-12">
          <section className="md:col-span-6 bg-[var(--color-paper)] p-8">
            <h1 className="font-sans text-[56px] leading-[0.9] tracking-tight text-[var(--color-forest)] md:text-[82px]">
              Draft Spec
            </h1>
            <div className="mt-6 flex items-start gap-4">
              <div className="mt-1 h-10 w-px bg-[rgba(58,58,56,0.2)]" />
              <p className="tech-meta ink-dim max-w-xl">
                Governance will define allowable strategies, risk parameter bounds, and emergency exit rules for the
                sovereign agent vault.
              </p>
            </div>
          </section>

          <section className="md:col-span-6 bg-[var(--color-paper)] p-8">
            <div className="tech-label ink-dim">Planned Modules</div>
            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                <div className="tech-label ink-dim">Risk Params</div>
                <div className="mt-2 text-[12px] leading-6 ink-dim">
                  Drawdown bounds, stop-loss rules, and position sizing.
                </div>
              </div>
              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                <div className="tech-label ink-dim">Strategy Allowlist</div>
                <div className="mt-2 text-[12px] leading-6 ink-dim">
                  Protocol integrations and safe execution constraints.
                </div>
              </div>
              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                <div className="tech-label ink-dim">Emergency Exit</div>
                <div className="mt-2 text-[12px] leading-6 ink-dim">
                  One-click unwind plan and verification steps.
                </div>
              </div>
              <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                <div className="tech-label ink-dim">Proposals</div>
                <div className="mt-2 text-[12px] leading-6 ink-dim">
                  Change log and parameter upgrade flow.
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
