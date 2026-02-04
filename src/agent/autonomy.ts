import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
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

function amountToBaseUnits(amount: { value: number; unit: 'SOL' | 'USDC' }) {
  if (amount.unit === 'SOL') return Math.floor(amount.value * 1_000_000_000 + 1e-8);
  return Math.floor(amount.value * 10 ** USDC_DECIMALS + 1e-8);
}

function getMintsForSwap(from: 'SOL' | 'USDC', to: 'SOL' | 'USDC') {
  const inputMint = from === 'SOL' ? SOL_MINT : USDC_MINT;
  const outputMint = to === 'SOL' ? SOL_MINT : USDC_MINT;
  return { inputMint, outputMint };
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
  if (opts?.owner) {
    await maybeProposeDrawdownHedge({
      connection,
      owner: opts.owner,
      solPrice,
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
      },
      simulation,
      from: swapFromHuman,
      to: swapToHuman,
    });

    db.prepare(
      `INSERT INTO proposals (id, owner, intent_id, kind, summary, quote_json, tx_base64, simulation_json, decision_report_json, created_by, status, created_at, updated_at)
       VALUES (@id, @owner, @intent_id, @kind, @summary, @quote_json, @tx_base64, @simulation_json, @decision_report_json, 'agent', 'PENDING_APPROVAL', @created_at, @updated_at)`
    ).run({
      id: proposalId,
      owner: row.owner,
      intent_id: row.id,
      kind: cfg.kind,
      summary,
      decision_report_json: JSON.stringify(decisionReport),
      quote_json: JSON.stringify({
        inAmount: quote.inAmount,
        outAmount: quote.outAmount,
        otherAmountThreshold: quote.otherAmountThreshold,
        priceImpactPct: quote.priceImpactPct,
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
    },
    simulation,
    from: 'SOL',
    to: 'USDC',
  });

  db.prepare(
    `INSERT INTO proposals (id, owner, intent_id, kind, summary, quote_json, tx_base64, simulation_json, decision_report_json, created_by, status, created_at, updated_at)
     VALUES (@id, @owner, NULL, @kind, @summary, @quote_json, @tx_base64, @simulation_json, @decision_report_json, 'agent', 'PENDING_APPROVAL', @created_at, @updated_at)`
  ).run({
    id: proposalId,
    owner: args.owner,
    kind: intent.kind,
    summary,
    decision_report_json: JSON.stringify(decisionReport),
    quote_json: JSON.stringify({
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      otherAmountThreshold: quote.otherAmountThreshold,
      priceImpactPct: quote.priceImpactPct,
    }),
    tx_base64: swap.swapTransactionBase64,
    simulation_json: JSON.stringify(simulation),
    created_at: args.now,
    updated_at: args.now,
  });
}
