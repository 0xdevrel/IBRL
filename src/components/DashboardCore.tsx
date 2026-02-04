'use client';

import React, { useEffect, useRef, useState } from 'react';
import { WalletContextProvider } from '@/components/WalletContextProvider';
import { WalletButton } from '@/components/WalletButton';
import { MarkdownMessage } from '@/components/MarkdownMessage';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, VersionedTransaction } from '@solana/web3.js';
import Link from 'next/link';

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-[2px] border border-[rgba(26,60,43,0.2)] px-3 py-1">
      <span className="h-2 w-2 bg-[var(--color-forest)]" />
      <span className="tech-label">{status}</span>
    </span>
  );
}

function NetworkTopologyGraph() {
  return (
      <div className="relative aspect-square w-full max-w-[450px] rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-[var(--color-paper)] p-6">
      <div className="tech-label ink-dim">Network Topology</div>
      <svg viewBox="0 0 240 240" className="mt-6 h-full w-full" role="img" aria-label="Network topology graph">
        <circle
          cx="120"
          cy="120"
          r="94"
          fill="none"
          stroke="rgba(58,58,56,0.35)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        <line x1="120" y1="120" x2="120" y2="26" stroke="rgba(58,58,56,0.2)" strokeWidth="1" />
        <line x1="120" y1="120" x2="203" y2="166" stroke="rgba(58,58,56,0.2)" strokeWidth="1" />
        <line x1="120" y1="120" x2="37" y2="166" stroke="rgba(58,58,56,0.2)" strokeWidth="1" />

        <circle cx="120" cy="120" r="8" fill="var(--color-forest)" />

        <g className="orbit-rotate">
          <circle cx="120" cy="26" r="6" fill="var(--color-paper)" stroke="rgba(58,58,56,0.35)" />
          <circle cx="203" cy="166" r="6" fill="var(--color-paper)" stroke="rgba(58,58,56,0.35)" />
          <circle cx="37" cy="166" r="6" fill="var(--color-paper)" stroke="rgba(58,58,56,0.35)" />
        </g>
      </svg>
    </div>
  );
}

function DashboardContent() {
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const howToFaqSectionRef = useRef<HTMLElement | null>(null);
  const [mosaicOffsetX, setMosaicOffsetX] = useState<number>(0);
  const terminalScrollRef = useRef<HTMLDivElement | null>(null);
  const terminalBottomRef = useRef<HTMLDivElement | null>(null);
  const intentInputRef = useRef<HTMLInputElement | null>(null);

  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [epochInfo, setEpochInfo] = useState<any>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [uptime, setUptime] = useState<string>('00:00:00');
  const [startTime] = useState(Date.now());

  const [intentInput, setIntentInput] = useState<string>('');
  const [intentHistory, setIntentHistory] = useState<any[]>([]);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionResults, setExecutionResults] = useState<any>(null);
  const [lastParsed, setLastParsed] = useState<{ prompt: string; intent: any } | null>(null);
  const [automationSaveStatus, setAutomationSaveStatus] = useState<string | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [savedAutomations, setSavedAutomations] = useState<any[]>([]);
  const [historyHydrated, setHistoryHydrated] = useState<boolean>(false);
  const [pendingTx, setPendingTx] = useState<null | {
    proposalId?: string;
    swapTransactionBase64: string;
    simulation: any;
    quote: any;
    prompt: string;
  }>(null);
  const [lastSignature, setLastSignature] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const handleIntentSubmit = async (execute: boolean = false) => {
    if (!connected) return;
    const promptForRequest = intentInput.trim() ? intentInput : lastParsed?.prompt || '';
    if (!promptForRequest.trim()) return;

    const promptSnapshot = promptForRequest;
    // Clear immediately on submit for a snappy terminal feel.
    setIntentInput('');
    setIsExecuting(true);
    
    try {
      const response = await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptSnapshot, execute, owner: publicKey?.toBase58() }),
      });

      const data = await response.json();
      if (!response.ok) {
        const reason = data?.reason || data?.error || 'Intent rejected';
        setIntentHistory((prev) => {
          const next = [
            ...prev.slice(Math.max(0, prev.length - 9)),
            {
              id: Date.now(),
              prompt: promptSnapshot,
              plan: [],
              intent: data?.intent,
              tx: null,
              blocked: true,
              reason,
              timestamp: new Date().toISOString(),
              executed: execute,
            },
          ];
          return next;
        });
        return;
      }

      setIntentHistory((prev) => {
        const next = [
          ...prev.slice(Math.max(0, prev.length - 9)),
          {
            id: Date.now(),
            prompt: promptSnapshot,
            plan: data.plan,
            intent: data.intent,
            tx: data.tx,
            quote: data.quote,
            agentReply: data.agentReply,
            blocked: data.blocked,
            reason: data.reason,
            timestamp: new Date().toISOString(),
            executed: execute,
          },
        ];
        return next;
      });

      setLastParsed({ prompt: promptSnapshot, intent: data.intent });
      setAutomationSaveStatus(null);
      setExecutionResults(data.tx?.simulation || null);
      if (data.tx?.swapTransactionBase64) {
        setPendingTx({ ...data.tx, prompt: promptSnapshot });
      }
    } catch (error) {
      console.error('Error submitting intent:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  useEffect(() => {
    // Keep most recent activity visible.
    const el = terminalScrollRef.current;
    if (!el) return;
    // Use scrollTop to avoid layout jumps.
    el.scrollTop = el.scrollHeight;
    terminalBottomRef.current?.scrollIntoView({ block: 'end' });
  }, [intentHistory, isExecuting]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleIntentSubmit(false);
    } else if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      handleIntentSubmit(true);
    }
  };

  const quickTemplates = [
    { label: 'Swap 0.1 SOL → USDC', prompt: 'Swap 0.1 SOL to USDC' },
    { label: 'Swap 10 USDC → SOL', prompt: 'Swap 10 USDC to SOL' },
    { label: 'Protect (exit)', prompt: 'Protect 0.25 SOL if SOL drops below 95' },
    { label: 'Buy dip (entry)', prompt: 'Buy SOL with 25 USDC if SOL drops below 90' },
    { label: 'DCA hourly', prompt: 'DCA 5 USDC to SOL every 1h' },
    { label: 'Fund Manager Q&A', prompt: 'Given my current balances, propose a conservative, balanced, and aggressive strategy. Explain the trade-offs.' },
  ];

  useEffect(() => {
    let cancelled = false;

    const fetchPrice = async () => {
      try {
        const res = await fetch('/api/price');
        const data = await res.json();
        const price = data?.solPrice;
        if (!cancelled && typeof price === 'number' && Number.isFinite(price)) {
          setSolPrice(price);
        }
      } catch (e) {
        console.error('Price fetch failed', e);
      }
    };

    const fetchEpoch = async () => {
      try {
        const info = await connection.getEpochInfo();
        if (!cancelled) setEpochInfo(info);
      } catch (e) {
        console.error('Epoch fetch failed', e);
      }
    };

    const fetchBalance = async () => {
      if (!publicKey) return;
      try {
        const bal = await connection.getBalance(publicKey);
        if (!cancelled) setBalance(bal / LAMPORTS_PER_SOL);
      } catch (e) {
        console.error('Balance fetch failed', e);
      }
    };

    fetchPrice();
    fetchEpoch();
    fetchBalance();

    const uptimeInterval = setInterval(() => {
      const diff = Date.now() - startTime;
      const hours = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const mins = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      if (!cancelled) setUptime(`${hours}:${mins}:${secs}`);
    }, 1000);

    const priceInterval = setInterval(fetchPrice, 15_000);
    const epochInterval = setInterval(fetchEpoch, 30_000);
    const balanceInterval = setInterval(() => {
      if (connected) fetchBalance();
    }, 10_000);

    return () => {
      cancelled = true;
      clearInterval(uptimeInterval);
      clearInterval(priceInterval);
      clearInterval(epochInterval);
      clearInterval(balanceInterval);
    };
  }, [connection, publicKey, connected, startTime]);

  useEffect(() => {
    const tileWidth = 320;
    const hairlineXs = [0, 96, 208, 240];

    const computeOffset = () => {
      const el = howToFaqSectionRef.current;
      if (typeof window === 'undefined' || !el) return;

      const isMdUp = window.matchMedia('(min-width: 768px)').matches;
      if (!isMdUp) {
        setMosaicOffsetX(0);
        return;
      }

      const rect = el.getBoundingClientRect();
      // Align the mosaic hairline grid to the vertical divider between the 5/12 and 7/12 columns.
      const dividerX = rect.left + rect.width * (5 / 12);
      const dividerMod = ((dividerX % tileWidth) + tileWidth) % tileWidth;

      let best = hairlineXs[0];
      let bestDist = Number.POSITIVE_INFINITY;
      for (const x of hairlineXs) {
        const raw = Math.abs(dividerMod - x);
        const dist = Math.min(raw, tileWidth - raw);
        if (dist < bestDist) {
          bestDist = dist;
          best = x;
        }
      }

      const offset = ((dividerX - best) % tileWidth + tileWidth) % tileWidth;
      setMosaicOffsetX(offset);
    };

    computeOffset();
    window.addEventListener('resize', computeOffset);
    return () => window.removeEventListener('resize', computeOffset);
  }, []);

  useEffect(() => {
    if (!connected || !publicKey) {
      setPendingApprovals([]);
      setSavedAutomations([]);
      setHistoryHydrated(false);
      return;
    }

    let cancelled = false;
    const owner = publicKey.toBase58();

    const loadApprovals = async () => {
      try {
        const res = await fetch(`/api/approvals?owner=${encodeURIComponent(owner)}`);
        const data = await res.json();
        if (!cancelled && res.ok) {
          setPendingApprovals(Array.isArray(data?.proposals) ? data.proposals : []);
        }
      } catch {
        // ignore
      }
    };

    const loadHistory = async () => {
      if (historyHydrated) return;
      try {
        const res = await fetch(`/api/history?owner=${encodeURIComponent(owner)}`);
        const data = await res.json();
        if (!cancelled && res.ok && Array.isArray(data?.interactions)) {
          const mapped = data.interactions
            .map((it: any) => {
              const payload = it?.payload || {};
              return {
                id: it.id,
                prompt: payload.prompt ?? it.prompt,
                plan: payload.plan ?? [],
                intent: payload.intent,
                tx: payload.tx ?? null,
                quote: payload.quote ?? null,
                agentReply: payload.agentReply,
                blocked: payload.blocked,
                reason: payload.reason,
                timestamp: payload.timestamp ? new Date(payload.timestamp).toISOString() : new Date(it.createdAt).toISOString(),
                executed: Boolean(it.execute),
              };
            })
            .filter(Boolean);

          // Keep the terminal lean.
          setIntentHistory(mapped.slice(-20));
          setHistoryHydrated(true);
        }
      } catch {
        // ignore
      }
    };

    const loadAutomations = async () => {
      try {
        const res = await fetch(`/api/intents?owner=${encodeURIComponent(owner)}`);
        const data = await res.json();
        if (!cancelled && res.ok) {
          setSavedAutomations(Array.isArray(data?.intents) ? data.intents : []);
        }
      } catch {
        // ignore
      }
    };

    loadApprovals();
    loadHistory();
    loadAutomations();
    const approvalsInterval = setInterval(loadApprovals, 10_000);
    const automationsInterval = setInterval(loadAutomations, 20_000);
    return () => {
      cancelled = true;
      clearInterval(approvalsInterval);
      clearInterval(automationsInterval);
    };
  }, [connected, publicKey, historyHydrated]);

  const saveAutomation = async () => {
    if (!publicKey || !connected || !lastParsed) return;
    if (!['PRICE_TRIGGER_EXIT', 'PRICE_TRIGGER_ENTRY', 'DCA_SWAP'].includes(lastParsed.intent?.kind)) return;

    setAutomationSaveStatus(null);
    try {
      const res = await fetch('/api/intents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ owner: publicKey.toBase58(), prompt: lastParsed.prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAutomationSaveStatus(String(data?.error || 'Failed to save automation.'));
        return;
      }
      setAutomationSaveStatus('Automation saved. Background agent will propose when the trigger fires.');
      // Refresh list
      const list = await fetch(`/api/intents?owner=${encodeURIComponent(publicKey.toBase58())}`);
      const listData = await list.json();
      if (list.ok) setSavedAutomations(Array.isArray(listData?.intents) ? listData.intents : []);
    } catch (e) {
      setAutomationSaveStatus(e instanceof Error ? e.message : 'Failed to save automation.');
    }
  };

  const refreshAutomations = async () => {
    if (!publicKey) return;
    try {
      const res = await fetch(`/api/intents?owner=${encodeURIComponent(publicKey.toBase58())}`);
      const data = await res.json();
      if (res.ok) setSavedAutomations(Array.isArray(data?.intents) ? data.intents : []);
    } catch {
      // ignore
    }
  };

  const toggleAutomation = async (id: string, next: 'PAUSE' | 'RESUME') => {
    if (!publicKey) return;
    try {
      await fetch(`/api/intents/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ owner: publicKey.toBase58(), action: next }),
      });
    } finally {
      refreshAutomations();
    }
  };

  const deleteAutomation = async (id: string) => {
    if (!publicKey) return;
    try {
      await fetch(`/api/intents/${encodeURIComponent(id)}?owner=${encodeURIComponent(publicKey.toBase58())}`, {
        method: 'DELETE',
      });
    } finally {
      refreshAutomations();
    }
  };

  const approveAndSend = async () => {
    if (!pendingTx?.swapTransactionBase64) return;
    const ok = pendingTx.simulation?.value?.err == null;
    if (!ok) return;
    if (!publicKey) return;

    try {
      setSendError(null);
      const tx = VersionedTransaction.deserialize(Buffer.from(pendingTx.swapTransactionBase64, 'base64'));
      const signature = await sendTransaction(tx, connection, { skipPreflight: false });
      setLastSignature(signature);
      if (pendingTx.proposalId) {
        fetch(`/api/proposals/${encodeURIComponent(pendingTx.proposalId)}/decision`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ decision: 'SENT', signature }),
        }).catch(() => {});
      }
      setPendingTx(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // If the user rejects in-wallet, treat as a normal cancel (don’t keep an errored state).
      if (message.toLowerCase().includes('user rejected')) {
        if (pendingTx?.proposalId) {
          fetch(`/api/proposals/${encodeURIComponent(pendingTx.proposalId)}/decision`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ decision: 'DENIED' }),
          }).catch(() => {});
        }
        setPendingTx(null);
        setSendError('Cancelled in wallet.');
        return;
      }
      setSendError(message);
    }
  };

  return (
    <div
      className="min-h-screen mosaic-bg selection:bg-[var(--color-forest)] selection:text-[var(--color-paper)]"
      style={{ ['--mosaic-offset-x' as any]: `${mosaicOffsetX}px` } as React.CSSProperties}
    >
      <header className="fixed inset-x-0 top-0 z-20 bg-[color:var(--color-paper)]/90 backdrop-blur-sm">
        <div className="hairline-b">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-10">
            <div className="flex items-center gap-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-[2px] bg-[var(--color-forest)]">
                <span className="text-[var(--color-paper)] font-bold">I</span>
              </div>
              <div>
                <div className="tech-label ink-dim">IBRL Sovereign Vault</div>
                <div className="tech-meta ink-dim">REF_ID: 466 • VER: 1.0.4</div>
              </div>
            </div>

            <nav className="hidden items-center gap-6 md:flex">
              <Link className="tech-label ink-dim hover:text-[var(--color-forest)]" href="/">
                01. Dashboard
              </Link>
              <Link className="tech-label ink-dim hover:text-[var(--color-forest)]" href="/docs">
                02. Documentation
              </Link>
              <Link className="tech-label ink-dim hover:text-[var(--color-forest)]" href="/security">
                03. Security
              </Link>
              <Link className="tech-label ink-dim hover:text-[var(--color-forest)]" href="/governance">
                04. Governance
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              <WalletButton />
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 pb-16 pt-24 md:px-10">
        <section className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-px rounded-[2px] bg-[rgba(58,58,56,0.2)] md:grid-cols-12">
            <div className="md:col-span-7 bg-[var(--color-paper)] p-8">
              <div className="flex items-center justify-between gap-4">
                <StatusBadge status={connected ? 'Secure Connection' : 'Connection Pending'} />
                <div className="hidden text-right md:block">
                  <div className="tech-label ink-dim">System Uptime</div>
                  <div className="tech-meta">{uptime}</div>
                </div>
              </div>

              <h1 className="mt-8 font-sans text-[56px] leading-[0.9] tracking-tight text-[var(--color-forest)] md:text-[82px]">
                Intelligent Blockchain Risk &amp; Liquidity
              </h1>
              <div className="mt-6 flex items-start gap-4">
                <div className="mt-1 h-10 w-px bg-[rgba(58,58,56,0.2)]" />
                <p className="tech-meta ink-dim max-w-xl">
                  Autonomous, intent-driven vault on Solana. Parse natural language into structured execution plans and
                  propose simulate-first transactions via Jupiter, plus optional price-trigger automations.
                </p>
              </div>

              <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                  <div className="tech-label ink-dim">SOL Price</div>
                  <div className="mt-2 font-mono text-2xl text-[var(--color-forest)]">
                    {solPrice ? `$${solPrice.toFixed(2)}` : '—'}
                  </div>
                </div>
                <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                  <div className="tech-label ink-dim">Epoch</div>
                  <div className="mt-2 font-mono text-2xl text-[var(--color-forest)]">{epochInfo?.epoch ?? '—'}</div>
                </div>
                <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                  <div className="tech-label ink-dim">Wallet Balance</div>
                  <div className="mt-2 font-mono text-2xl text-[var(--color-forest)]">
                    {balance?.toFixed(4) || '0.0000'} SOL
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-5 bg-[var(--color-paper)] p-8">
              <NetworkTopologyGraph />
            </div>
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-6xl">
          <div className="grid grid-cols-1 gap-px rounded-[2px] bg-[rgba(58,58,56,0.2)] md:grid-cols-12">
            <div className="md:col-span-4 bg-[var(--color-paper)] p-8">
              <div className="flex items-center justify-between">
                <div className="tech-label ink-dim">Vault Status</div>
                <span className="tech-label ink-dim">Primary</span>
              </div>

              <div className="mt-6 space-y-6">
                <div>
                  <div className="tech-label ink-dim">Identity</div>
                  <div className="mt-2 font-mono text-sm">
                    {connected && publicKey ? `@user_${publicKey.toString().slice(0, 4)}` : '—'}
                  </div>
                </div>

                <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                  <div className="tech-label ink-dim">Connection</div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <StatusBadge status={connected ? 'Established' : 'Pending'} />
                    <div className="tech-meta ink-dim">{connected ? 'Ready' : 'Authorize wallet'}</div>
                  </div>
                </div>

                <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                  <div className="tech-label ink-dim">Instructions</div>
                  <div className="mt-3 text-[12px] leading-6 ink-dim">
                    <span className="font-mono">Enter</span>: Parse intent
                    <span className="mx-2 text-[rgba(58,58,56,0.4)]">•</span>
                    <span className="font-mono">Shift+Enter</span>: Build + simulate
                    <span className="mx-2 text-[rgba(58,58,56,0.4)]">•</span>
                    <span className="font-mono">Ask</span>: portfolio Q&amp;A (no auto-trades)
                  </div>
                </div>

                <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="tech-label ink-dim">Approvals</div>
                    <div className="tech-label ink-dim">{pendingApprovals.length}</div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {pendingApprovals.length === 0 ? (
                      <div className="text-[12px] ink-dim">No pending proposals.</div>
                    ) : (
                      pendingApprovals.slice(0, 4).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-[var(--color-paper)] px-3 py-2 text-left hover:opacity-90 transition-opacity duration-150 ease-out"
                          onClick={() =>
                            setPendingTx({
                              proposalId: p.id,
                              swapTransactionBase64: p.txBase64,
                              simulation: p.simulation,
                              quote: p.quote,
                              prompt: p.summary,
                            })
                          }
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="tech-label ink-dim">Pending</div>
                            <div className="tech-label ink-dim">
                              {p.createdAt ? new Date(p.createdAt).toLocaleTimeString() : ''}
                            </div>
                          </div>
                          <div className="mt-1 text-[12px] ink-strong">{p.summary}</div>
                        </button>
                      ))
                    )}
                    {pendingApprovals.length > 4 && (
                      <div className="text-[10px] uppercase tracking-[0.12em] ink-muted font-semibold">
                        +{pendingApprovals.length - 4} more pending proposals
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="tech-label ink-dim">Automations</div>
                    <div className="tech-label ink-dim">{savedAutomations.length}</div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {savedAutomations.length === 0 ? (
                      <div className="text-[12px] ink-dim">
                        Save an automation like{' '}
                        <span className="font-mono">Protect 0.25 SOL if SOL drops below 95</span> or{' '}
                        <span className="font-mono">DCA 5 USDC to SOL every 1h</span>.
                      </div>
                    ) : (
                      savedAutomations.slice(0, 2).map((a) => (
                        <div
                          key={a.id}
                          className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-[var(--color-paper)] p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="tech-label ink-dim">{a.status === 'PAUSED' ? 'Paused' : 'Active'}</div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="h-8 rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white px-3 tech-button ink-dim hover:text-[var(--color-forest)]"
                                onClick={() => toggleAutomation(a.id, a.status === 'PAUSED' ? 'RESUME' : 'PAUSE')}
                              >
                                {a.status === 'PAUSED' ? 'Resume' : 'Pause'}
                              </button>
                              <button
                                type="button"
                                className="h-8 rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-transparent px-3 tech-button text-[rgba(58,58,56,0.7)] hover:text-[var(--color-coral)]"
                                onClick={() => deleteAutomation(a.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <div className="mt-2 text-[12px] ink-strong">
                            {a.kind === 'PRICE_TRIGGER_EXIT' || a.config?.kind === 'PRICE_TRIGGER_EXIT'
                              ? `Exit ${a.config?.amount?.value} SOL if SOL/USD ≤ $${a.config?.thresholdUsd}`
                              : a.kind === 'PRICE_TRIGGER_ENTRY' || a.config?.kind === 'PRICE_TRIGGER_ENTRY'
                                ? `Buy SOL with ${a.config?.amount?.value} USDC if SOL/USD ≤ $${a.config?.thresholdUsd}`
                                : a.kind === 'DCA_SWAP' || a.config?.kind === 'DCA_SWAP'
                                  ? `Every ${a.config?.intervalMinutes}m: swap ${a.config?.amount?.value} ${a.config?.from} → ${a.config?.to}`
                                  : 'Automation'}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-8 bg-[var(--color-paper)] p-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="tech-label ink-dim">Intent Engine</div>
                  <div className="tech-meta ink-dim">Natural language → structured plan</div>
                </div>
                <span className="tech-label ink-dim">v1.0.4</span>
              </div>

              <div className="mt-6 rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white">
                <div className="hairline-b flex items-center justify-between px-4 py-3">
                  <div className="tech-label ink-dim">Terminal</div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 bg-[var(--color-coral)]" />
                    <span className="h-2 w-2 bg-[var(--color-gold)]" />
                    <span className="h-2 w-2 bg-[var(--color-mint)]" />
                  </div>
                </div>

                <div ref={terminalScrollRef} className="max-h-[420px] overflow-y-auto p-4 font-mono text-sm leading-6">
                  <div className="text-[var(--color-forest)]">[SYSTEM] Initializing IBRL Sovereign Protocol...</div>
                  <div className="ink-dim">[DEBUG] Loaded Strategy: Intent-Driven Sovereign Vault</div>
                  <div className="ink-dim">[DEBUG] RPC: via /api/rpc (proxied)</div>

                  <div className="mt-4">
                    {connected ? (
                      <div className="ink-strong">
                        <span className="text-[var(--color-forest)]">@user_{publicKey?.toString().slice(0, 4)}:</span>{' '}
                        Hello IBRL.
                        <br />
                        <span className="text-[var(--color-forest)]">[IBRL]:</span> Sovereign identity confirmed. Ready
                        to execute intents. Your current balance is {balance?.toFixed(4)} SOL.
                      </div>
                    ) : (
                      <div className="ink-dim italic">
                        Waiting for wallet authorization to unlock Intent Engine...
                      </div>
                    )}
                  </div>

                  <div className="mt-6 space-y-4">
                    {intentHistory.map((item) => (
                      <div key={item.id} className="border-l border-[rgba(58,58,56,0.2)] pl-4">
                        <div className="tech-label text-[rgba(58,58,56,0.6)]">
                          {new Date(item.timestamp).toLocaleTimeString()}
                          {item.executed && <span className="ml-2 text-[var(--color-forest)]">[EXECUTED]</span>}
                        </div>
                        <div className="mt-1 ink-strong">
                          <span className="text-[var(--color-forest)]">@user_{publicKey?.toString().slice(0, 4)}:</span>{' '}
                          {item.prompt}
                        </div>
                        {item.blocked ? (
                          <div className="mt-2 text-xs text-[var(--color-coral)] ml-4">
                            <span className="tech-label ink-dim">[IBRL]:</span> {item.reason || 'Blocked'}
                          </div>
                        ) : item.agentReply ? (
                          <div className="mt-2 text-xs ink-dim ml-4">
                            <div className="tech-label ink-dim">[IBRL]:</div>
                            <div className="mt-1">
                              <MarkdownMessage text={String(item.agentReply)} />
                            </div>
                          </div>
                        ) : item.plan?.length ? (
                          <div className="mt-2 text-xs ink-dim">
                            <span className="text-[var(--color-forest)]">[IBRL]:</span> Generated {item.plan?.length}{' '}
                            step strategy
                            {item.plan?.map((step: any, idx: number) => (
                              <div key={idx} className="ml-4">
                                {idx + 1}. {step.type}: {step.description}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {item.quote && (
                          <div className="mt-2 text-xs ink-dim ml-4">
                            Quote: out={String(item.quote.outAmount)} • impact={String(item.quote.priceImpactPct)}
                          </div>
                        )}
                        {item.tx?.simulation && (
                          <div className="mt-2 text-xs ml-4">
                            <span className={item.tx.simulation?.value?.err ? 'text-[var(--color-coral)]' : 'text-[var(--color-forest)]'}>
                              {item.tx.simulation?.value?.err ? 'SIMULATION: ERR' : 'SIMULATION: OK'}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {isExecuting && (
                    <div className="mt-6 text-[var(--color-forest)]">
                      <span className="font-bold">[IBRL]:</span> Processing intent...
                    </div>
                  )}
                  <div ref={terminalBottomRef} />
                </div>

                <div className="relative bg-[var(--color-paper)] p-4">
                  <div className="pointer-events-none absolute inset-0">
                    <div className="corner-marker left-2 top-2 border-l-2 border-t-2" />
                    <div className="corner-marker right-2 top-2 border-r-2 border-t-2" />
                    <div className="corner-marker bottom-2 left-2 border-b-2 border-l-2" />
                    <div className="corner-marker bottom-2 right-2 border-b-2 border-r-2" />
                  </div>

                  <label className="tech-label ink-dim block" htmlFor="intent">
                    Command
                  </label>
                  <div className="mt-2 flex items-center gap-3 rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white px-3 py-3">
                    <span className="font-mono text-[var(--color-forest)]">&gt;</span>
                    <input
                      id="intent"
                      type="text"
                      ref={intentInputRef}
                      value={intentInput}
                      onChange={(e) => setIntentInput(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder={
                        connected
                          ? "Enter intent (e.g. 'Swap 0.1 SOL to USDC', 'Swap 10 USDC to SOL', 'Protect 0.25 SOL if SOL drops below 95', or 'DCA 5 USDC to SOL every 1h')"
                          : 'Connect wallet to enter intent...'
                      }
                      className="flex-1 bg-transparent font-mono text-sm uppercase tracking-[0.06em] text-[rgba(58,58,56,0.95)] outline-none placeholder:text-[rgba(58,58,56,0.45)]"
                      disabled={!connected || isExecuting}
                    />
                    <button
                      type="button"
                      className="h-10 rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-[var(--color-forest)] px-4 font-mono text-[12px] uppercase tracking-[0.12em] text-[var(--color-paper)] transition-opacity duration-150 ease-out hover:opacity-90 disabled:opacity-50"
                      onClick={() => handleIntentSubmit(false)}
                      disabled={!connected || isExecuting || !intentInput.trim()}
                    >
                      Parse
                    </button>
                    <button
                      type="button"
                      className="h-10 rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-transparent px-4 font-mono text-[12px] font-semibold uppercase tracking-[0.12em] ink-dim transition-colors duration-150 ease-out hover:text-[var(--color-forest)] disabled:opacity-50"
                      onClick={() => handleIntentSubmit(true)}
                      disabled={!connected || isExecuting || !(intentInput.trim() || lastParsed?.prompt)}
                    >
                      Simulate
                    </button>
                    {['PRICE_TRIGGER_EXIT', 'PRICE_TRIGGER_ENTRY', 'DCA_SWAP'].includes(lastParsed?.intent?.kind) && (
                      <button
                        type="button"
                        className="h-10 rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white px-4 tech-button ink-dim hover:text-[var(--color-forest)] disabled:opacity-50"
                        onClick={saveAutomation}
                        disabled={!connected || isExecuting}
                      >
                        Save Automation
                      </button>
                    )}
                  </div>

                  {connected && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="tech-label ink-dim">Templates</span>
                      {quickTemplates.map((t) => (
                        <button
                          key={t.label}
                          type="button"
                          className="h-8 rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-[var(--color-paper)] px-3 tech-button ink-dim hover:text-[var(--color-forest)]"
                          onClick={() => {
                            setIntentInput(t.prompt);
                            setAutomationSaveStatus(null);
                            intentInputRef.current?.focus();
                          }}
                          disabled={isExecuting}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {automationSaveStatus && (
                    <div className="mt-3 text-[10px] uppercase tracking-[0.12em] ink-dim font-semibold">
                      {automationSaveStatus}
                    </div>
                  )}

                  {pendingTx && (
                    <div className="mt-3 rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="tech-label ink-dim">Simulation</div>
                        <div className="tech-label ink-dim">{pendingTx.simulation?.value?.err ? 'ERR' : 'OK'}</div>
                      </div>
                      {pendingTx.simulation?.value?.err ? (
                        <div className="mt-2 text-xs text-[var(--color-coral)]">
                          Simulation failed. Adjust intent/amount and try again.
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <div className="text-xs ink-dim">
                            Ready to execute. Approval required.
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="h-9 rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-[var(--color-forest)] px-4 tech-button text-[var(--color-paper)] hover:opacity-90 transition-opacity duration-150 ease-out"
                              onClick={approveAndSend}
                            >
                              Approve &amp; Send
                            </button>
                            <button
                              type="button"
                              className="h-9 rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-transparent px-4 tech-button ink-dim hover:text-[var(--color-forest)]"
                              onClick={() => {
                                if (pendingTx?.proposalId) {
                                  fetch(`/api/proposals/${encodeURIComponent(pendingTx.proposalId)}/decision`, {
                                    method: 'POST',
                                    headers: { 'content-type': 'application/json' },
                                    body: JSON.stringify({ decision: 'DENIED' }),
                                  }).catch(() => {});
                                }
                                setPendingTx(null);
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {sendError && (
                    <div className="mt-3 text-[10px] uppercase tracking-[0.12em] text-[var(--color-coral)] font-semibold">
                      {sendError}
                    </div>
                  )}

                  {lastSignature && (
                    <div className="mt-3 text-[10px] uppercase tracking-[0.12em] ink-muted font-semibold">
                      Last TX: {lastSignature.slice(0, 8)}…{lastSignature.slice(-8)}
                    </div>
                  )}

                  <div className="mt-2 text-[10px] uppercase tracking-[0.12em] ink-muted font-semibold">
                    Enter parses • Shift+Enter simulates • Wallet approves send • Server RPC proxied
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section ref={howToFaqSectionRef} className="mx-auto mt-10 max-w-6xl">
          <div className="grid grid-cols-1 gap-px rounded-[2px] bg-[rgba(58,58,56,0.2)] md:grid-cols-12">
            <div className="md:col-span-5 bg-[var(--color-paper)] p-8">
              <h3 className="font-sans text-[28px] leading-[1.05] tracking-tight text-[var(--color-forest)]">
                How To Use
              </h3>
              <div className="tech-meta ink-dim mt-2">Simulate-first execution with explicit approval</div>

              <div className="mt-6 space-y-3">
                <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                  <div className="tech-label ink-dim">01. Connect</div>
                  <div className="mt-2 text-[12px] leading-6 ink-dim">
                    Click <span className="font-mono">Select Wallet</span> and connect Phantom (or another supported wallet).
                  </div>
                </div>
                <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                  <div className="tech-label ink-dim">02. Parse</div>
                  <div className="mt-2 text-[12px] leading-6 ink-dim">
                    Type an intent and press <span className="font-mono">Enter</span>. Example:{' '}
                    <span className="font-mono">Swap 0.1 SOL to USDC</span>.
                  </div>
                </div>
                <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                  <div className="tech-label ink-dim">03. Simulate</div>
                  <div className="mt-2 text-[12px] leading-6 ink-dim">
                    Click <span className="font-mono">Simulate</span> (or <span className="font-mono">Shift+Enter</span>) to build
                    a real Jupiter swap transaction and run on-chain simulation.
                  </div>
                </div>
                <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                  <div className="tech-label ink-dim">04. Approve &amp; Send</div>
                  <div className="mt-2 text-[12px] leading-6 ink-dim">
                    If simulation is OK, click <span className="font-mono">Approve &amp; Send</span>. Your wallet will prompt you
                    to sign. Rejecting will cancel the pending transaction.
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-7 bg-[var(--color-paper)] p-8">
              <h3 className="font-sans text-[28px] leading-[1.05] tracking-tight text-[var(--color-forest)]">
                FAQ
              </h3>
              <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                  <div className="tech-label ink-dim">Is this automated?</div>
                  <div className="mt-2 text-[12px] leading-6 ink-dim">
                    The agent proposes actions and simulates them, but execution always requires your explicit wallet approval.
                  </div>
                </div>
                <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                  <div className="tech-label ink-dim">Do you store my keys?</div>
                  <div className="mt-2 text-[12px] leading-6 ink-dim">
                    No. You sign transactions in your wallet. RPC vendor keys stay server-side behind the <span className="font-mono">/api/rpc</span>{' '}
                    proxy.
                  </div>
                </div>
                <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                  <div className="tech-label ink-dim">Why simulate first?</div>
                  <div className="mt-2 text-[12px] leading-6 ink-dim">
                    Simulation reduces surprises (fees, account issues) and lets you reject before anything is broadcast.
                  </div>
                </div>
                <div className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white p-4">
                  <div className="tech-label ink-dim">What intents work?</div>
                  <div className="mt-2 text-[12px] leading-6 ink-dim">
                    Currently: <span className="font-mono">Swap X SOL to USDC</span>, <span className="font-mono">Swap X USDC to SOL</span>,{' '}
                    <span className="font-mono">Exit X SOL to USDC</span>, <span className="font-mono">Protect X SOL if SOL drops below Y</span>{' '}
                    (automation), and <span className="font-mono">DCA X USDC to SOL every Nh</span> (automation).
                    More will be added behind strict policies.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="mx-auto mt-12 max-w-6xl">
          <div className="hairline-t flex flex-col items-center justify-between gap-4 py-6 md:flex-row">
            <div className="tech-label ink-muted">© 2026 IBRL Sovereign Systems</div>
            <div className="flex gap-6">
              <Link className="tech-label ink-muted hover:text-[var(--color-forest)]" href="/docs">
                Documentation
              </Link>
              <Link className="tech-label ink-muted hover:text-[var(--color-forest)]" href="/security">
                Security Audit
              </Link>
              <Link className="tech-label ink-muted hover:text-[var(--color-forest)]" href="/governance">
                Governance
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default function DashboardCore() {
  return (
    <WalletContextProvider>
      <DashboardContent />
    </WalletContextProvider>
  );
}
