'use client';

import React, { useEffect, useState } from 'react';
import { WalletContextProvider } from '@/components/WalletContextProvider';
import { WalletButton } from '@/components/WalletButton';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
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
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();

  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [epochInfo, setEpochInfo] = useState<any>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [uptime, setUptime] = useState<string>('00:00:00');
  const [startTime] = useState(Date.now());

  const [intentInput, setIntentInput] = useState<string>('');
  const [intentHistory, setIntentHistory] = useState<any[]>([]);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionResults, setExecutionResults] = useState<any>(null);

  const handleIntentSubmit = async (execute: boolean = false) => {
    if (!intentInput.trim() || !connected) return;

    setIsExecuting(true);

    try {
      const response = await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: intentInput, execute }),
      });

      const data = await response.json();

      setIntentHistory((prev) => [
        {
          id: Date.now(),
          prompt: intentInput,
          plan: data.plan,
          executionResults: data.executionResults,
          timestamp: new Date().toISOString(),
          executed: execute,
        },
        ...prev.slice(0, 9),
      ]);

      setExecutionResults(data.executionResults);
      setIntentInput('');
    } catch (error) {
      console.error('Error submitting intent:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleIntentSubmit(false);
    } else if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      handleIntentSubmit(true);
    }
  };

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

  return (
    <div className="min-h-screen mosaic-bg selection:bg-[var(--color-forest)] selection:text-[var(--color-paper)]">
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
              <button
                type="button"
                className="hidden h-11 min-w-[220px] items-center justify-center rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-transparent px-6 tech-button ink-dim hover:text-[var(--color-forest)] md:inline-flex"
              >
                System
              </button>
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
                  route strategies through Jupiter + Kamino (prototype integrations).
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
                    <span className="font-mono">Shift+Enter</span>: Execute (server-side signer)
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

                <div className="max-h-[420px] overflow-y-auto p-4 font-mono text-sm leading-6">
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
                        <div className="mt-2 text-xs ink-dim">
                          <span className="text-[var(--color-forest)]">[IBRL]:</span> Generated {item.plan?.length}{' '}
                          step strategy
                          {item.plan?.map((step: any, idx: number) => (
                            <div key={idx} className="ml-4">
                              {idx + 1}. {step.type}: {step.description}
                            </div>
                          ))}
                        </div>
                        {item.executionResults && (
                          <div className="mt-2 text-xs">
                            {item.executionResults.map((result: any, idx: number) => (
                              <div
                                key={idx}
                                className={`ml-4 ${
                                  result.success ? 'text-[var(--color-forest)]' : 'text-[var(--color-coral)]'
                                }`}
                              >
                                {result.success ? 'OK' : 'ERR'} • {result.details?.transaction || 'Step completed'}
                                {result.signature && (
                                  <div className="tech-label mt-1 text-[rgba(58,58,56,0.6)]">
                                    TX: {result.signature.slice(0, 8)}...{result.signature.slice(-8)}
                                  </div>
                                )}
                              </div>
                            ))}
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
                      value={intentInput}
                      onChange={(e) => setIntentInput(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder={connected ? "Enter intent (e.g. 'Optimize yield on 0.5 SOL')" : 'Connect wallet to enter intent...'}
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
                      disabled={!connected || isExecuting || !intentInput.trim()}
                    >
                      Execute
                    </button>
                  </div>

                  <div className="mt-2 text-[10px] uppercase tracking-[0.12em] ink-muted font-semibold">
                    Enter parses • Shift+Enter executes • Server RPC proxied
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
