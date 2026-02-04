import Link from 'next/link';

export default function SecurityPage() {
  return (
    <div className="min-h-screen mosaic-bg px-4 pb-16 pt-10 md:px-10">
      <header className="mx-auto max-w-6xl">
        <div className="hairline-b flex items-center justify-between py-6">
          <div>
            <div className="tech-label ink-dim">Security Audit</div>
            <div className="tech-meta ink-dim">Threat model • Controls • Open risks</div>
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
          <section className="md:col-span-8 bg-[var(--color-paper)] p-8">
            <h1 className="font-sans text-[56px] leading-[0.9] tracking-tight text-[var(--color-forest)] md:text-[82px]">
              In Progress
            </h1>
            <div className="mt-6 flex items-start gap-4">
              <div className="mt-1 h-10 w-px bg-[rgba(58,58,56,0.2)]" />
              <p className="tech-meta ink-dim max-w-2xl">
                This prototype includes a server-side signer and a secure same-origin RPC proxy. A full audit report will
                document key handling, transaction simulation, rate limiting, and strategy safety constraints.
              </p>
            </div>
          </section>

          <section className="md:col-span-4 bg-[var(--color-paper)] p-8">
            <div className="tech-label ink-dim">Current Controls</div>
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
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
