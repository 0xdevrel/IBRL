'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { WalletContextProvider } from '@/components/WalletContextProvider';
import { WalletButton } from '@/components/WalletButton';
import { MarkdownMessage } from '@/components/MarkdownMessage';
import { useWallet } from '@solana/wallet-adapter-react';

function formatTs(ts: number | null | undefined) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'PENDING_APPROVAL'
      ? 'var(--color-forest)'
      : status === 'SENT'
        ? 'var(--color-mint)'
        : 'var(--color-coral)';
  return (
    <span className="inline-flex items-center gap-2 rounded-[2px] border border-[rgba(26,60,43,0.2)] px-3 py-1">
      <span className="h-2 w-2" style={{ backgroundColor: color }} />
      <span className="tech-label">{status.replaceAll('_', ' ')}</span>
    </span>
  );
}

type ActivityPayload = {
  owner: string;
  summary: {
    activeAutomations: number;
    totalAutomations: number;
    pendingApprovals: number;
    lastProposalAt: number | null;
    lastInteractionAt: number | null;
    lastPriceSampleAt: number | null;
  };
  proposals: Array<{
    id: string;
    kind: string;
    summary: string;
    status: 'PENDING_APPROVAL' | 'SENT' | 'DENIED';
    signature: string | null;
    createdBy: string;
    createdAt: number;
    decisionReport?: any | null;
  }>;
  interactions: Array<{
    id: string;
    prompt: string;
    execute: boolean;
    ok: boolean;
    payload: any;
    createdAt: number;
  }>;
  intents: Array<{
    id: string;
    kind: string;
    status: string;
    lastFiredAt: number | null;
    createdAt: number;
  }>;
  priceSamples: Array<{ source: string; price: number; ts: number }>;
};

function ActivityContent() {
  const { publicKey, connected } = useWallet();
  const owner = publicKey?.toBase58() || '';

  const [data, setData] = useState<ActivityPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!owner) {
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/activity?owner=${encodeURIComponent(owner)}`);
        const json = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(String(json?.error || 'Failed to load activity.'));
          return;
        }
        if (!cancelled) {
          setData(json as ActivityPayload);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    refresh();
    const interval = setInterval(refresh, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [owner]);

  const latestPrice = useMemo(() => {
    const p = data?.priceSamples?.[0]?.price;
    return typeof p === 'number' && Number.isFinite(p) ? p : null;
  }, [data]);

  return (
    <div className="min-h-screen mosaic-bg pb-16">
      <header className="sticky top-0 z-20 bg-[color:var(--color-paper)]/92 backdrop-blur-sm">
        <div className="hairline-b">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-10">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                aria-label="Go to dashboard"
                className="flex h-8 w-8 items-center justify-center rounded-[2px] bg-[var(--color-forest)] focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)] focus:ring-offset-2 focus:ring-offset-[var(--color-paper)]"
              >
                <span className="text-[var(--color-paper)] font-bold">I</span>
              </Link>
              <div>
                <div className="tech-label ink-strong">Agent Activity</div>
                <div className="tech-meta ink-dim">Monitoring • Automations • Proposals • Logs</div>
              </div>
            </div>

            <nav className="hidden items-center gap-6 md:flex">
              <Link className="tech-label ink-dim hover:text-[var(--color-forest)]" href="/">
                01. Dashboard
              </Link>
              <Link className="tech-label ink-dim hover:text-[var(--color-forest)]" href="/inbox">
                02. Inbox
              </Link>
              <Link className="tech-label ink-dim hover:text-[var(--color-forest)]" href="/activity">
                03. Activity
              </Link>
              <Link className="tech-label ink-dim hover:text-[var(--color-forest)]" href="/docs">
                04. Documentation
              </Link>
              <Link className="tech-label ink-dim hover:text-[var(--color-forest)]" href="/security">
                05. Security
              </Link>
              <Link className="tech-label ink-dim hover:text-[var(--color-forest)]" href="/governance">
                06. Governance
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              <WalletButton />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-10 max-w-6xl px-4 md:px-10">
        {!connected ? (
          <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-8">
            <div className="tech-label ink-dim">Connect wallet</div>
            <div className="mt-2 text-[12px] leading-6 ink-dim">
              Activity is scoped to your wallet public key. Connect a wallet to view your automations, proposals, and logs.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-px rounded-[2px] bg-[rgba(58,58,56,0.2)] md:grid-cols-12">
              <section className="md:col-span-7 bg-[var(--color-paper)] p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="tech-label ink-dim">Status</div>
                  <div className="tech-meta ink-dim">{loading ? 'Syncing…' : 'Live'}</div>
                </div>
                {error && (
                  <div className="mt-3 text-[10px] uppercase tracking-[0.12em] text-[var(--color-coral)] font-semibold">
                    {error}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                    <div className="tech-label ink-dim">SOL/USD</div>
                    <div className="mt-2 font-mono text-2xl text-[var(--color-forest)]">
                      {latestPrice != null ? `$${latestPrice.toFixed(2)}` : '—'}
                    </div>
                    <div className="mt-2 tech-meta ink-dim">Last sample: {formatTs(data?.summary?.lastPriceSampleAt)}</div>
                  </div>
                  <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                    <div className="tech-label ink-dim">Automations</div>
                    <div className="mt-2 font-mono text-2xl text-[var(--color-forest)]">
                      {data ? `${data.summary.activeAutomations}/${data.summary.totalAutomations}` : '—'}
                    </div>
                    <div className="mt-2 tech-meta ink-dim">Last proposal: {formatTs(data?.summary?.lastProposalAt)}</div>
                  </div>
                  <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                    <div className="tech-label ink-dim">Pending</div>
                    <div className="mt-2 font-mono text-2xl text-[var(--color-forest)]">
                      {data ? `${data.summary.pendingApprovals}` : '—'}
                    </div>
                    <div className="mt-2 tech-meta ink-dim">Last log: {formatTs(data?.summary?.lastInteractionAt)}</div>
                  </div>
                </div>

                <div className="mt-4 rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                  <div className="tech-label ink-dim">Runbook (for demo)</div>
                  <div className="mt-2 text-[12px] leading-6 ink-dim">
                    Run <span className="font-mono">npm run start:agent</span> in a separate terminal to continuously evaluate automations and monitoring loops.
                    New proposals will appear in <span className="font-mono">/inbox</span> and include a decision report.
                  </div>
                </div>
              </section>

              <section className="md:col-span-5 bg-[var(--color-paper)] p-6">
                <div className="tech-label ink-dim">Recent Proposals</div>
                <div className="mt-4 space-y-2">
                  {(data?.proposals || []).slice(0, 8).map((p) => (
                    <div key={p.id} className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="tech-label ink-strong truncate">{p.summary}</div>
                          <div className="mt-1 tech-meta ink-dim truncate">
                            {p.kind} • {p.createdBy} • {formatTs(p.createdAt)}
                          </div>
                        </div>
                        <StatusBadge status={p.status} />
                      </div>
                      {p.decisionReport?.markdown && (
                        <div className="mt-3 text-[12px] leading-6 ink-dim">
                          <MarkdownMessage text={String(p.decisionReport.markdown)} />
                        </div>
                      )}
                    </div>
                  ))}
                  {(data?.proposals || []).length === 0 && (
                    <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                      <div className="tech-meta ink-dim">No proposals yet. Save an automation or trigger a simulation.</div>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="grid grid-cols-1 gap-px rounded-[2px] bg-[rgba(58,58,56,0.2)] md:grid-cols-12">
              <section className="md:col-span-6 bg-[var(--color-paper)] p-6">
                <div className="tech-label ink-dim">Automations</div>
                <div className="mt-4 space-y-2">
                  {(data?.intents || []).slice(0, 10).map((i) => (
                    <div key={i.id} className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="tech-label ink-strong">{i.kind}</div>
                        <div className="tech-meta ink-dim">{i.status}</div>
                      </div>
                      <div className="mt-2 tech-meta ink-dim">
                        Created: {formatTs(i.createdAt)} • Last fired: {formatTs(i.lastFiredAt)}
                      </div>
                    </div>
                  ))}
                  {(data?.intents || []).length === 0 && (
                    <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                      <div className="tech-meta ink-dim">No automations saved yet.</div>
                    </div>
                  )}
                </div>
              </section>

              <section className="md:col-span-6 bg-[var(--color-paper)] p-6">
                <div className="tech-label ink-dim">Interaction Log</div>
                <div className="mt-4 space-y-2">
                  {(data?.interactions || []).slice(0, 12).map((it) => (
                    <div key={it.id} className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="tech-label ink-strong truncate">{it.prompt}</div>
                        <div className="tech-meta ink-dim">{formatTs(it.createdAt)}</div>
                      </div>
                      {it.payload?.agentReply && (
                        <div className="mt-3 text-[12px] leading-6 ink-dim">
                          <MarkdownMessage text={String(it.payload.agentReply)} />
                        </div>
                      )}
                      {it.payload?.reason && (
                        <div className="mt-3 text-[10px] uppercase tracking-[0.12em] text-[var(--color-coral)] font-semibold">
                          {String(it.payload.reason)}
                        </div>
                      )}
                    </div>
                  ))}
                  {(data?.interactions || []).length === 0 && (
                    <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                      <div className="tech-meta ink-dim">No interactions recorded yet.</div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ActivityCore() {
  return (
    <WalletContextProvider>
      <ActivityContent />
    </WalletContextProvider>
  );
}

