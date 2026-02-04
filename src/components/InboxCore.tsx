'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { VersionedTransaction } from '@solana/web3.js';
import { WalletContextProvider } from '@/components/WalletContextProvider';
import { WalletButton } from '@/components/WalletButton';
import { MarkdownMessage } from '@/components/MarkdownMessage';

type Proposal = {
  id: string;
  kind: string;
  summary: string;
  status: 'PENDING_APPROVAL' | 'SENT' | 'DENIED';
  signature: string | null;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
  txBase64?: string | null;
  simulation?: any | null;
  quote?: any | null;
  decisionReport?: any | null;
};

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

function formatTs(ts: number) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function InboxContent() {
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const owner = publicKey?.toBase58() || '';

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING_APPROVAL' | 'SENT' | 'DENIED'>('PENDING_APPROVAL');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const selectedSimOk = Boolean(selected?.simulation) && selected?.simulation?.value?.err == null;

  const filtered = useMemo(() => {
    if (statusFilter === 'ALL') return proposals;
    return proposals.filter((p) => p.status === statusFilter);
  }, [proposals, statusFilter]);

  useEffect(() => {
    if (!owner) return;
    let cancelled = false;

    const refresh = async () => {
      setLoading(true);
      try {
        const qs =
          statusFilter === 'ALL'
            ? `owner=${encodeURIComponent(owner)}&limit=100`
            : `owner=${encodeURIComponent(owner)}&status=${encodeURIComponent(statusFilter)}&limit=100`;
        const res = await fetch(`/api/proposals?${qs}`);
        const data = await res.json();
        if (!res.ok) return;
        if (cancelled) return;
        const list = (data?.proposals || []) as Proposal[];
        setProposals(list);
        if (!selectedId && list[0]?.id) setSelectedId(list[0].id);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    refresh();
    const interval = setInterval(refresh, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [owner, statusFilter, selectedId]);

  useEffect(() => {
    if (!owner || !selectedId) {
      setSelected(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/proposals/${encodeURIComponent(selectedId)}?owner=${encodeURIComponent(owner)}`);
      const data = await res.json();
      if (!res.ok) return;
      if (!cancelled) setSelected(data as Proposal);
    })();
    return () => {
      cancelled = true;
    };
  }, [owner, selectedId]);

  const deny = async () => {
    if (!owner || !selectedId) return;
    setActionError(null);
    await fetch(`/api/proposals/${encodeURIComponent(selectedId)}/decision`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ owner, decision: 'DENIED' }),
    }).catch(() => {});
    setProposals((prev) => prev.map((p) => (p.id === selectedId ? { ...p, status: 'DENIED' } : p)));
    setSelected((prev) => (prev && prev.id === selectedId ? { ...prev, status: 'DENIED' } : prev));
  };

  const isUserRejected = (e: unknown) => {
    const anyErr = e as any;
    const message = String(anyErr?.message || anyErr || '').toLowerCase();
    const name = String(anyErr?.name || '').toLowerCase();
    const code = anyErr?.code;
    if (message.includes('user rejected')) return true;
    if (name.includes('walletsendtransactionerror') && message.includes('rejected')) return true;
    // Common EIP-1193 rejection code (some adapters forward this).
    if (code === 4001) return true;
    return false;
  };

  const approveAndSend = async () => {
    if (!owner || !connected || !selected?.txBase64) return;
    if (!selectedSimOk) {
      setActionError('Simulation is not OK (or missing); refusing to send.');
      return;
    }
    setActionError(null);
    try {
      const tx = VersionedTransaction.deserialize(Buffer.from(selected.txBase64, 'base64'));
      const signature = await sendTransaction(tx, connection, { skipPreflight: false });
      await fetch(`/api/proposals/${encodeURIComponent(selected.id)}/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ owner, decision: 'SENT', signature }),
      }).catch(() => {});
      setProposals((prev) => prev.map((p) => (p.id === selected.id ? { ...p, status: 'SENT', signature } : p)));
      setSelected((prev) => (prev && prev.id === selected.id ? { ...prev, status: 'SENT', signature } : prev));
    } catch (e) {
      if (isUserRejected(e)) {
        await fetch(`/api/proposals/${encodeURIComponent(selected.id)}/decision`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ owner, decision: 'DENIED' }),
        }).catch(() => {});
        setProposals((prev) => prev.map((p) => (p.id === selected.id ? { ...p, status: 'DENIED' } : p)));
        setSelected((prev) => (prev && prev.id === selected.id ? { ...prev, status: 'DENIED' } : prev));
        setActionError('Cancelled in wallet.');
        return;
      }
      const message = e instanceof Error ? e.message : String(e);
      setActionError(message);
    }
  };

  return (
    <div className="min-h-screen mosaic-bg pb-16">
      <header className="sticky top-0 z-20 bg-[color:var(--color-paper)]/92 backdrop-blur-sm">
        <div className="hairline-b">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-10">
            <div className="flex items-center gap-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-[2px] bg-[var(--color-forest)]">
                <span className="text-[var(--color-paper)] font-bold">I</span>
              </div>
              <div>
                <div className="tech-label ink-strong">Approvals Inbox</div>
                <div className="tech-meta ink-dim">Full list • Details • Decision reports</div>
              </div>
            </div>

            <nav className="hidden items-center gap-6 md:flex">
              <Link className="tech-label ink-dim hover:text-[var(--color-forest)]" href="/">
                01. Dashboard
              </Link>
              <Link className="tech-label ink-dim hover:text-[var(--color-forest)]" href="/inbox">
                02. Inbox
              </Link>
              <Link className="tech-label ink-dim hover:text-[var(--color-forest)]" href="/docs">
                03. Documentation
              </Link>
              <Link className="tech-label ink-dim hover:text-[var(--color-forest)]" href="/security">
                04. Security
              </Link>
              <Link className="tech-label ink-dim hover:text-[var(--color-forest)]" href="/governance">
                05. Governance
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
              The inbox is scoped to your wallet public key. Connect a wallet to view and approve proposals.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-px rounded-[2px] bg-[rgba(58,58,56,0.2)] md:grid-cols-12">
            <section className="md:col-span-5 bg-[var(--color-paper)] p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="tech-label ink-dim">Proposals</div>
                <div className="tech-meta ink-dim">{loading ? 'Syncing…' : `${proposals.length} total`}</div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {(
                  [
                    ['PENDING_APPROVAL', 'Pending'],
                    ['SENT', 'Sent'],
                    ['DENIED', 'Denied'],
                    ['ALL', 'All'],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    className={`h-10 rounded-[2px] border border-[rgba(58,58,56,0.2)] px-3 tech-button ${
                      statusFilter === v
                        ? 'bg-[var(--color-forest)] text-[var(--color-paper)]'
                        : 'bg-white ink-dim hover:text-[var(--color-forest)]'
                    }`}
                    onClick={() => setStatusFilter(v)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-4 max-h-[70vh] overflow-auto pr-1">
                <div className="space-y-2">
                  {filtered.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`w-full rounded-[2px] border border-[rgba(58,58,56,0.2)] p-4 text-left transition-colors ${
                        selectedId === p.id ? 'bg-white' : 'bg-[var(--color-paper)] hover:bg-white'
                      }`}
                      onClick={() => setSelectedId(p.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="tech-label ink-strong truncate">{p.summary}</div>
                          <div className="mt-1 tech-meta ink-dim truncate">{p.kind}</div>
                        </div>
                        <div className="shrink-0">
                          <StatusBadge status={p.status} />
                        </div>
                      </div>
                      <div className="mt-2 tech-meta ink-dim">{formatTs(p.createdAt)}</div>
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                      <div className="tech-meta ink-dim">No proposals for this filter.</div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="md:col-span-7 bg-[var(--color-paper)] p-6">
              {!selected ? (
                <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-6">
                  <div className="tech-label ink-dim">Select a proposal</div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-sans text-[22px] font-semibold tracking-tight text-[var(--color-forest)] truncate">
                          {selected.summary}
                        </div>
                        <div className="mt-1 tech-meta ink-dim">
                          ID: <span className="font-mono">{selected.id.slice(0, 8)}…</span> • Created{' '}
                          {formatTs(selected.createdAt)} • By {selected.createdBy || 'agent'}
                        </div>
                      </div>
                      <StatusBadge status={selected.status} />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {selected.status === 'PENDING_APPROVAL' && (
                        <>
                          <button
                            type="button"
                            className="h-11 rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-[var(--color-forest)] px-6 tech-button text-[var(--color-paper)] hover:opacity-90 transition-opacity duration-150 ease-out disabled:opacity-50"
                            onClick={approveAndSend}
                            disabled={!selected.txBase64 || !selectedSimOk}
                          >
                            Approve &amp; Send
                          </button>
                          <button
                            type="button"
                            className="h-11 rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-transparent px-6 tech-button ink-dim hover:text-[var(--color-forest)]"
                            onClick={deny}
                          >
                            Deny
                          </button>
                        </>
                      )}
                      {selected.status === 'SENT' && selected.signature && (
                        <div className="tech-meta ink-dim">
                          Signature: <span className="font-mono">{selected.signature}</span>
                        </div>
                      )}
                      {actionError && (
                        <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-coral)] font-semibold">
                          {actionError}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div className="tech-label ink-dim">Decision Report</div>
                      <div className="tech-meta ink-dim">
                        Simulation: {selected.simulation ? (selected.simulation?.value?.err ? 'ERR' : 'OK') : '—'}
                      </div>
                    </div>
                    {!selectedSimOk && selected.status === 'PENDING_APPROVAL' && (
                      <div className="mt-3 text-[10px] uppercase tracking-[0.12em] text-[var(--color-coral)] font-semibold">
                        Not sendable: simulation missing or failed.
                      </div>
                    )}
                    <div className="mt-4 text-[12px] leading-6 ink-dim">
                      {selected.decisionReport?.markdown ? (
                        <MarkdownMessage text={String(selected.decisionReport.markdown)} />
                      ) : (
                        <div className="tech-meta ink-dim">No report recorded for this proposal.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default function InboxCore() {
  return (
    <WalletContextProvider>
      <InboxContent />
    </WalletContextProvider>
  );
}
