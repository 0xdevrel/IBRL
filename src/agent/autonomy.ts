import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import crypto from 'node:crypto';
import { getDb } from '@/lib/db';
import { getSolUsdPriceFromHermes } from '@/lib/pyth';
import { JupiterManager } from '@/agent/jupiter';
import { enforcePolicy } from '@/agent/policy';
import type { Intent } from '@/agent/intentSchema';
import { buildDecisionReport } from '@/lib/decisionReport';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_DECIMALS = 6;
const USDC_MINT_KEY = new PublicKey(USDC_MINT);

function extractRouteSummary(quote: any) {
  const routePlan = Array.isArray(quote?.routePlan) ? quote.routePlan : Array.isArray(quote?.route_plan) ? quote.route_plan : null;
  if (!routePlan) return null;
  const venues: string[] = [];
  for (const hop of routePlan) {
    const label =
      (typeof hop?.swapInfo?.label === 'string' && hop.swapInfo.label.trim()) ||
      (typeof hop?.swapInfo?.marketMeta?.label === 'string' && hop.swapInfo.marketMeta.label.trim()) ||
      '';
    if (label && !venues.includes(label)) venues.push(label);
    if (venues.length >= 6) break;
  }
  return { hopCount: routePlan.length, venues };
}

async function getUsdcBalance(connection: Connection, owner: string) {
  const ownerKey = new PublicKey(owner);
  const ata = getAssociatedTokenAddressSync(USDC_MINT_KEY, ownerKey, false);
  try {
    const bal = await connection.getTokenAccountBalance(ata);
    const amount = Number(bal.value.amount);
    const decimals = bal.value.decimals;
    return amount / 10 ** decimals;
  } catch {
    return 0;
  }
}

function amountToBaseUnits(amount: { value: number; unit: 'SOL' | 'USDC' }) {
  if (amount.unit === 'SOL') return Math.floor(amount.value * 1_000_000_000 + 1e-8);
  return Math.floor(amount.value * 10 ** USDC_DECIMALS + 1e-8);
}

function getMintsForSwap(from: 'SOL' | 'USDC', to: 'SOL' | 'USDC') {
  const inputMint = from === 'SOL' ? SOL_MINT : USDC_MINT;
  const outputMint = to === 'SOL' ? SOL_MINT : USDC_MINT;
  return { inputMint, outputMint };
}

function computeRealizedVol(rows: Array<{ price: number; ts: number }>) {
  if (rows.length < 12) return null;
  const sorted = [...rows].sort((a, b) => a.ts - b.ts);
  const returns: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const p0 = Number(sorted[i - 1].price);
    const p1 = Number(sorted[i].price);
    if (!Number.isFinite(p0) || !Number.isFinite(p1) || p0 <= 0 || p1 <= 0) continue;
    returns.push(Math.log(p1 / p0));
  }
  if (returns.length < 10) return null;

  const mean = returns.reduce((s, x) => s + x, 0) / returns.length;
  const variance = returns.reduce((s, x) => s + (x - mean) * (x - mean), 0) / Math.max(1, returns.length - 1);
  const stdev = Math.sqrt(Math.max(0, variance));

  const prices = sorted.map((r) => Number(r.price)).filter((p) => Number.isFinite(p) && p > 0);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const last = prices[prices.length - 1];
  const rangePct = min > 0 ? (max - min) / min : 0;

  return {
    windowMs: sorted[sorted.length - 1].ts - sorted[0].ts,
    sampleCount: sorted.length,
    returnCount: returns.length,
    stdevLogReturn: stdev, // dimensionless per-sample log-return stdev
    rangePct,
    lastPrice: last,
    min,
    max,
  };
}

export async function evaluateAutonomy(connection: Connection, opts?: { owner?: string }) {
  const db = getDb();
  const intents = db
    .prepare(
      `SELECT id, owner, kind, config_json, status, last_fired_at
       FROM intents
       WHERE status = 'ACTIVE' ${opts?.owner ? 'AND owner = @owner' : ''}`
    )
    .all(opts?.owner ? { owner: opts.owner } : {}) as any[];

  let solPrice: number | null = null;
  try {
    const { price } = await getSolUsdPriceFromHermes();
    solPrice = price;
  } catch {
    solPrice = null;
  }
  if (!solPrice) return;

  const jupiter = new JupiterManager(connection);
  const now = Date.now();

  // Record monitoring sample for drawdown detection and transparency.
  try {
    db.prepare(`INSERT INTO price_samples (id, source, price, ts) VALUES (?, ?, ?, ?)`).run(
      crypto.randomUUID(),
      'pyth_hermes',
      solPrice,
      now
    );
  } catch {
    // best-effort only
  }

  // Autonomous loop (non-trigger): drawdown hedge proposal if price drops sharply.
  const owners = opts?.owner
    ? [opts.owner]
    : (() => {
        const set = new Set<string>();
        for (const r of intents) {
          const o = String(r.owner || '').trim();
          if (o) set.add(o);
        }
        try {
          const ps = db.prepare(`SELECT DISTINCT owner FROM proposals LIMIT 500`).all() as any[];
          for (const r of ps) {
            const o = String(r?.owner || '').trim();
            if (o) set.add(o);
          }
        } catch {
          // ignore
        }
        try {
          const is = db.prepare(`SELECT DISTINCT owner FROM interactions WHERE owner IS NOT NULL LIMIT 500`).all() as any[];
          for (const r of is) {
            const o = String(r?.owner || '').trim();
            if (o) set.add(o);
          }
        } catch {
          // ignore
        }
        return Array.from(set);
      })();
  for (const owner of owners) {
    await maybeProposeDrawdownHedge({
      connection,
      owner,
      solPrice,
      now,
      jupiter,
    });
    await maybeProposeUsdcBuffer({
      connection,
      owner,
      now,
      jupiter,
    });
    await maybeProposeVolatilityReduceRisk({
      connection,
      owner,
      now,
      jupiter,
    });
  }

  for (const row of intents) {
    let cfg: Intent;
    try {
      cfg = JSON.parse(row.config_json);
    } catch {
      continue;
    }
    if (cfg.kind !== 'PRICE_TRIGGER_EXIT' && cfg.kind !== 'PRICE_TRIGGER_ENTRY' && cfg.kind !== 'DCA_SWAP') continue;

    // Skip if there is already a pending proposal for this intent.
    const pending = db
      .prepare(`SELECT id FROM proposals WHERE intent_id = ? AND status = 'PENDING_APPROVAL' LIMIT 1`)
      .get(row.id) as any | undefined;
    if (pending) continue;

    // Evaluate trigger/schedule.
    if (cfg.kind === 'PRICE_TRIGGER_EXIT' || cfg.kind === 'PRICE_TRIGGER_ENTRY') {
      if (solPrice > cfg.thresholdUsd) continue;
      // Throttle repeated firing (15 minutes).
      if (row.last_fired_at && now - Number(row.last_fired_at) < 15 * 60_000) continue;
    }

    if (cfg.kind === 'DCA_SWAP') {
      const intervalMs = cfg.intervalMinutes * 60_000;
      if (row.last_fired_at && now - Number(row.last_fired_at) < intervalMs) continue;
    }

    // Re-check policy at execution time (balances may have changed).
    const policy = await enforcePolicy(connection, row.owner, cfg);
    if (!policy.ok) continue;

    const swapFrom = cfg.kind === 'PRICE_TRIGGER_ENTRY' ? 'USDC' : cfg.kind === 'DCA_SWAP' ? cfg.from : 'SOL';
    const swapTo = cfg.kind === 'PRICE_TRIGGER_ENTRY' ? 'SOL' : cfg.kind === 'DCA_SWAP' ? cfg.to : 'USDC';
    const { inputMint, outputMint } = getMintsForSwap(swapFrom, swapTo);
    const amountBaseUnits = amountToBaseUnits(cfg.amount as any);

    const quote = await jupiter.getQuote(inputMint, outputMint, amountBaseUnits, cfg.slippageBps);
    if (!quote) continue;

    const swap = await jupiter.swap(quote, row.owner);
    if (!swap) continue;

    const simulation = await connection.simulateTransaction(swap.transaction, {
      sigVerify: false,
      commitment: 'processed',
    });

    const proposalId = crypto.randomUUID();
    const summary =
      cfg.kind === 'PRICE_TRIGGER_EXIT'
        ? `Auto-trigger: exit ${cfg.amount.value} SOL → USDC (SOL/USD ≤ $${cfg.thresholdUsd})`
        : cfg.kind === 'PRICE_TRIGGER_ENTRY'
          ? `Auto-trigger: buy SOL with ${cfg.amount.value} USDC (SOL/USD ≤ $${cfg.thresholdUsd})`
          : `DCA: swap ${cfg.amount.value} ${cfg.amount.unit} ${cfg.from} → ${cfg.to}`;

    const swapFromHuman = swapFrom;
    const swapToHuman = swapTo;
    const decisionReport = buildDecisionReport({
      owner: row.owner,
      prompt: `AUTO: ${summary}`,
      intent: cfg,
      policy,
      summary,
      quote: {
        inAmount: quote.inAmount,
        outAmount: quote.outAmount,
        otherAmountThreshold: quote.otherAmountThreshold,
        priceImpactPct: quote.priceImpactPct,
        route: extractRouteSummary(quote) || undefined,
      },
      simulation,
      from: swapFromHuman,
      to: swapToHuman,
    });

    db.prepare(
      `INSERT INTO proposals (id, owner, intent_id, kind, summary, intent_json, quote_json, tx_base64, simulation_json, decision_report_json, created_by, status, created_at, updated_at)
       VALUES (@id, @owner, @intent_id, @kind, @summary, @intent_json, @quote_json, @tx_base64, @simulation_json, @decision_report_json, 'agent', 'PENDING_APPROVAL', @created_at, @updated_at)`
    ).run({
      id: proposalId,
      owner: row.owner,
      intent_id: row.id,
      kind: cfg.kind,
      summary,
      intent_json: JSON.stringify(cfg),
      decision_report_json: JSON.stringify(decisionReport),
      quote_json: JSON.stringify({
        inAmount: quote.inAmount,
        outAmount: quote.outAmount,
        otherAmountThreshold: quote.otherAmountThreshold,
        priceImpactPct: quote.priceImpactPct,
        route: extractRouteSummary(quote) || undefined,
      }),
      tx_base64: swap.swapTransactionBase64,
      simulation_json: JSON.stringify(simulation),
      created_at: now,
      updated_at: now,
    });

    db.prepare(`UPDATE intents SET last_fired_at = ?, updated_at = ? WHERE id = ?`).run(now, now, row.id);
  }
}

async function maybeProposeDrawdownHedge(args: {
  connection: Connection;
  owner: string;
  solPrice: number;
  now: number;
  jupiter: JupiterManager;
}) {
  const db = getDb();
  const lookbackMs = 12 * 60_000;
  const rows = db
    .prepare(`SELECT price, ts FROM price_samples WHERE ts >= ? ORDER BY ts ASC`)
    .all(args.now - lookbackMs) as any[];
  if (rows.length < 4) return;

  const max = rows.reduce((m: number, r: any) => Math.max(m, Number(r.price) || 0), 0);
  if (!max) return;
  const drawdown = (max - args.solPrice) / max;
  const drawdownPct = drawdown * 100;

  // Require a meaningful move to avoid spam.
  if (drawdown < 0.03) return;

  // Cooldown: one hedge proposal per 30 minutes.
  const recent = db
    .prepare(
      `SELECT id FROM proposals
       WHERE owner = ? AND created_by = 'agent' AND created_at >= ? AND summary LIKE 'Auto-hedge:%'
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(args.owner, args.now - 30 * 60_000) as any | undefined;
  if (recent) return;

  let solBalance = 0;
  try {
    const lamports = await args.connection.getBalance(new PublicKey(args.owner));
    solBalance = lamports / LAMPORTS_PER_SOL;
  } catch {
    return;
  }
  if (solBalance < 0.06) return;

  const proposed = Math.min(0.25, solBalance * 0.25);
  const amount = Math.max(0.05, Math.floor(proposed * 100) / 100);

  const intent: Extract<Intent, { kind: 'EXIT_TO_USDC' }> = {
    kind: 'EXIT_TO_USDC',
    amount: { value: amount, unit: 'SOL' },
    slippageBps: 50,
  };

  const policy = await enforcePolicy(args.connection, args.owner, intent);
  if (!policy.ok) return;

  const { inputMint, outputMint } = getMintsForSwap('SOL', 'USDC');
  const amountBaseUnits = amountToBaseUnits(intent.amount);
  const quote = await args.jupiter.getQuote(inputMint, outputMint, amountBaseUnits, intent.slippageBps);
  if (!quote) return;
  const swap = await args.jupiter.swap(quote, args.owner);
  if (!swap) return;
  const simulation = await args.connection.simulateTransaction(swap.transaction, {
    sigVerify: false,
    commitment: 'processed',
  });

  const proposalId = crypto.randomUUID();
  const summary = `Auto-hedge: exit ${amount} SOL → USDC (drawdown ${drawdownPct.toFixed(2)}% / ~12m)`;
  const decisionReport = buildDecisionReport({
    owner: args.owner,
    prompt: `AUTO: Drawdown hedge detected (${drawdownPct.toFixed(2)}% in ~12m).`,
    intent,
    policy,
    summary,
    quote: {
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      otherAmountThreshold: quote.otherAmountThreshold,
      priceImpactPct: quote.priceImpactPct,
      route: extractRouteSummary(quote) || undefined,
    },
    simulation,
    from: 'SOL',
    to: 'USDC',
  });

  db.prepare(
    `INSERT INTO proposals (id, owner, intent_id, kind, summary, intent_json, quote_json, tx_base64, simulation_json, decision_report_json, created_by, status, created_at, updated_at)
     VALUES (@id, @owner, NULL, @kind, @summary, @intent_json, @quote_json, @tx_base64, @simulation_json, @decision_report_json, 'agent', 'PENDING_APPROVAL', @created_at, @updated_at)`
  ).run({
    id: proposalId,
    owner: args.owner,
    kind: intent.kind,
    summary,
    intent_json: JSON.stringify(intent),
    decision_report_json: JSON.stringify(decisionReport),
    quote_json: JSON.stringify({
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      otherAmountThreshold: quote.otherAmountThreshold,
      priceImpactPct: quote.priceImpactPct,
      route: extractRouteSummary(quote) || undefined,
    }),
    tx_base64: swap.swapTransactionBase64,
    simulation_json: JSON.stringify(simulation),
    created_at: args.now,
    updated_at: args.now,
  });
}

async function maybeProposeUsdcBuffer(args: {
  connection: Connection;
  owner: string;
  now: number;
  jupiter: JupiterManager;
}) {
  const db = getDb();

  // Require recent usage to avoid proposing for long-abandoned wallets.
  const recent = db
    .prepare(`SELECT created_at FROM interactions WHERE owner = ? ORDER BY created_at DESC LIMIT 1`)
    .get(args.owner) as any | undefined;
  if (!recent || args.now - Number(recent.created_at) > 7 * 24 * 60 * 60_000) return;

  // Skip if already has a pending buffer proposal.
  const pending = db
    .prepare(
      `SELECT id FROM proposals WHERE owner = ? AND status = 'PENDING_APPROVAL' AND summary LIKE 'Auto-buffer:%' LIMIT 1`
    )
    .get(args.owner) as any | undefined;
  if (pending) return;

  // Cooldown: once per 2 hours.
  const last = db
    .prepare(
      `SELECT created_at FROM proposals
       WHERE owner = ? AND created_by = 'agent' AND summary LIKE 'Auto-buffer:%'
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(args.owner) as any | undefined;
  if (last && args.now - Number(last.created_at) < 2 * 60 * 60_000) return;

  let solBalance = 0;
  try {
    const lamports = await args.connection.getBalance(new PublicKey(args.owner));
    solBalance = lamports / LAMPORTS_PER_SOL;
  } catch {
    return;
  }
  const usdcBalance = await getUsdcBalance(args.connection, args.owner);

  // Only propose if USDC buffer is low but SOL balance is meaningful.
  if (solBalance < 0.15) return;
  if (usdcBalance >= 2) return;

  const amount = Math.max(0.02, Math.min(0.05, Math.floor(solBalance * 0.08 * 100) / 100));
  const intent: Extract<Intent, { kind: 'EXIT_TO_USDC' }> = {
    kind: 'EXIT_TO_USDC',
    amount: { value: amount, unit: 'SOL' },
    slippageBps: 50,
  };

  const policy = await enforcePolicy(args.connection, args.owner, intent);
  if (!policy.ok) return;

  const { inputMint, outputMint } = getMintsForSwap('SOL', 'USDC');
  const amountBaseUnits = amountToBaseUnits(intent.amount);
  const quote = await args.jupiter.getQuote(inputMint, outputMint, amountBaseUnits, intent.slippageBps);
  if (!quote) return;
  const swap = await args.jupiter.swap(quote, args.owner);
  if (!swap) return;

  const simulation = await args.connection.simulateTransaction(swap.transaction, {
    sigVerify: false,
    commitment: 'processed',
  });

  const proposalId = crypto.randomUUID();
  const summary = `Auto-buffer: exit ${amount} SOL → USDC (USDC buffer low: ${usdcBalance.toFixed(2)} USDC)`;
  const decisionReport = buildDecisionReport({
    owner: args.owner,
    prompt: `AUTO: Maintain a small USDC buffer for stability/fees when USDC is low.`,
    intent,
    policy,
    summary,
    quote: {
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      otherAmountThreshold: quote.otherAmountThreshold,
      priceImpactPct: quote.priceImpactPct,
      route: extractRouteSummary(quote) || undefined,
    },
    simulation,
    from: 'SOL',
    to: 'USDC',
  });

  db.prepare(
    `INSERT INTO proposals (id, owner, intent_id, kind, summary, intent_json, quote_json, tx_base64, simulation_json, decision_report_json, created_by, status, created_at, updated_at)
     VALUES (@id, @owner, NULL, @kind, @summary, @intent_json, @quote_json, @tx_base64, @simulation_json, @decision_report_json, 'agent', 'PENDING_APPROVAL', @created_at, @updated_at)`
  ).run({
    id: proposalId,
    owner: args.owner,
    kind: intent.kind,
    summary,
    intent_json: JSON.stringify(intent),
    decision_report_json: JSON.stringify(decisionReport),
    quote_json: JSON.stringify({
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      otherAmountThreshold: quote.otherAmountThreshold,
      priceImpactPct: quote.priceImpactPct,
      route: extractRouteSummary(quote) || undefined,
    }),
    tx_base64: swap.swapTransactionBase64,
    simulation_json: JSON.stringify(simulation),
    created_at: args.now,
    updated_at: args.now,
  });
}

async function maybeProposeVolatilityReduceRisk(args: {
  connection: Connection;
  owner: string;
  now: number;
  jupiter: JupiterManager;
}) {
  const db = getDb();

  // Require recent usage to avoid proposing for long-abandoned wallets.
  const recent = db
    .prepare(`SELECT created_at FROM interactions WHERE owner = ? ORDER BY created_at DESC LIMIT 1`)
    .get(args.owner) as any | undefined;
  if (!recent || args.now - Number(recent.created_at) > 7 * 24 * 60 * 60_000) return;

  // Skip if already has a pending vol proposal.
  const pending = db
    .prepare(
      `SELECT id FROM proposals WHERE owner = ? AND status = 'PENDING_APPROVAL' AND summary LIKE 'Auto-volatility:%' LIMIT 1`
    )
    .get(args.owner) as any | undefined;
  if (pending) return;

  // Cooldown: strict (6 hours).
  const last = db
    .prepare(
      `SELECT created_at FROM proposals
       WHERE owner = ? AND created_by = 'agent' AND summary LIKE 'Auto-volatility:%'
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(args.owner) as any | undefined;
  if (last && args.now - Number(last.created_at) < 6 * 60 * 60_000) return;

  // Compute realized volatility from recent price samples (global oracle).
  const lookbackMs = 30 * 60_000;
  const rows = db
    .prepare(`SELECT price, ts FROM price_samples WHERE ts >= ? ORDER BY ts ASC LIMIT 500`)
    .all(args.now - lookbackMs) as any[];
  const vol = computeRealizedVol(
    rows.map((r) => ({ price: Number(r.price), ts: Number(r.ts) })).filter((r) => Number.isFinite(r.price) && Number.isFinite(r.ts))
  );
  if (!vol) return;

  // Trigger thresholds: require both high range and high return stdev to reduce false positives.
  const rangeOk = vol.rangePct >= 0.035; // 3.5% range in ~30m
  const stdevOk = vol.stdevLogReturn >= 0.006; // ~0.6% per-sample log-return stdev
  if (!rangeOk || !stdevOk) return;

  let solBalance = 0;
  try {
    const lamports = await args.connection.getBalance(new PublicKey(args.owner));
    solBalance = lamports / LAMPORTS_PER_SOL;
  } catch {
    return;
  }
  const usdcBalance = await getUsdcBalance(args.connection, args.owner);

  // If user already has a decent USDC buffer, don't bother.
  if (usdcBalance >= 25) return;
  if (solBalance < 0.25) return;

  const amount = Math.max(0.05, Math.min(0.15, Math.floor(solBalance * 0.12 * 100) / 100));
  const intent: Extract<Intent, { kind: 'EXIT_TO_USDC' }> = {
    kind: 'EXIT_TO_USDC',
    amount: { value: amount, unit: 'SOL' },
    slippageBps: 50,
  };

  const policy = await enforcePolicy(args.connection, args.owner, intent);
  if (!policy.ok) return;

  const { inputMint, outputMint } = getMintsForSwap('SOL', 'USDC');
  const amountBaseUnits = amountToBaseUnits(intent.amount);
  const quote = await args.jupiter.getQuote(inputMint, outputMint, amountBaseUnits, intent.slippageBps);
  if (!quote) return;
  const swap = await args.jupiter.swap(quote, args.owner);
  if (!swap) return;

  const simulation = await args.connection.simulateTransaction(swap.transaction, {
    sigVerify: false,
    commitment: 'processed',
  });

  const metricLine = `σ≈${(vol.stdevLogReturn * 100).toFixed(2)}% (range ${(vol.rangePct * 100).toFixed(2)}% / 30m, n=${vol.returnCount})`;
  const proposalId = crypto.randomUUID();
  const summary = `Auto-volatility: reduce risk by exiting ${amount} SOL → USDC (${metricLine})`;
  const decisionReport = buildDecisionReport({
    owner: args.owner,
    prompt: `AUTO: Volatility spike detected. Proposing a small risk reduction exit.`,
    intent,
    policy,
    summary,
    triggerMetricLine: metricLine,
    quote: {
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      otherAmountThreshold: quote.otherAmountThreshold,
      priceImpactPct: quote.priceImpactPct,
      route: extractRouteSummary(quote) || undefined,
    },
    simulation,
    from: 'SOL',
    to: 'USDC',
  });

  db.prepare(
    `INSERT INTO proposals (id, owner, intent_id, kind, summary, intent_json, quote_json, tx_base64, simulation_json, decision_report_json, created_by, status, created_at, updated_at)
     VALUES (@id, @owner, NULL, @kind, @summary, @intent_json, @quote_json, @tx_base64, @simulation_json, @decision_report_json, 'agent', 'PENDING_APPROVAL', @created_at, @updated_at)`
  ).run({
    id: proposalId,
    owner: args.owner,
    kind: intent.kind,
    summary,
    intent_json: JSON.stringify(intent),
    decision_report_json: JSON.stringify(decisionReport),
    quote_json: JSON.stringify({
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      otherAmountThreshold: quote.otherAmountThreshold,
      priceImpactPct: quote.priceImpactPct,
      route: extractRouteSummary(quote) || undefined,
    }),
    tx_base64: swap.swapTransactionBase64,
    simulation_json: JSON.stringify(simulation),
    created_at: args.now,
    updated_at: args.now,
  });
}
