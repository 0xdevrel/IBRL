import { Connection } from '@solana/web3.js';
import crypto from 'node:crypto';
import { getDb } from '@/lib/db';
import { getSolUsdPriceFromHermes } from '@/lib/pyth';
import { JupiterManager } from '@/agent/jupiter';
import { enforcePolicy } from '@/agent/policy';
import type { Intent } from '@/agent/intentSchema';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export async function evaluateAutonomy(connection: Connection) {
  const db = getDb();
  const intents = db
    .prepare(
      `SELECT id, owner, kind, config_json, status, last_fired_at
       FROM intents
       WHERE status = 'ACTIVE'`
    )
    .all() as any[];

  if (!intents.length) return;

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

  for (const row of intents) {
    if (row.kind !== 'PRICE_TRIGGER_EXIT') continue;

    let cfg: Intent;
    try {
      cfg = JSON.parse(row.config_json);
    } catch {
      continue;
    }
    if (cfg.kind !== 'PRICE_TRIGGER_EXIT') continue;

    // Trigger condition not met.
    if (solPrice > cfg.thresholdUsd) continue;

    // Throttle repeated firing (15 minutes).
    if (row.last_fired_at && now - Number(row.last_fired_at) < 15 * 60_000) continue;

    // Skip if there is already a pending proposal for this intent.
    const pending = db
      .prepare(
        `SELECT id FROM proposals WHERE intent_id = ? AND status = 'PENDING_APPROVAL' LIMIT 1`
      )
      .get(row.id) as any | undefined;
    if (pending) continue;

    // Re-check policy at execution time (balance may have changed).
    const policy = await enforcePolicy(connection, row.owner, cfg);
    if (!policy.ok) continue;

    const amountLamports = Math.floor(cfg.amount.value * 1_000_000_000);
    const quote = await jupiter.getQuote(SOL_MINT, USDC_MINT, amountLamports, cfg.slippageBps);
    if (!quote) continue;

    const swap = await jupiter.swap(quote, row.owner);
    if (!swap) continue;

    const simulation = await connection.simulateTransaction(swap.transaction, {
      sigVerify: false,
      commitment: 'processed',
    });

    const proposalId = crypto.randomUUID();
    const summary = `Auto-trigger: exit ${cfg.amount.value} SOL → USDC (SOL/USD ≤ $${cfg.thresholdUsd})`;
    db.prepare(
      `INSERT INTO proposals (id, owner, intent_id, kind, summary, quote_json, tx_base64, simulation_json, status, created_at, updated_at)
       VALUES (@id, @owner, @intent_id, @kind, @summary, @quote_json, @tx_base64, @simulation_json, 'PENDING_APPROVAL', @created_at, @updated_at)`
    ).run({
      id: proposalId,
      owner: row.owner,
      intent_id: row.id,
      kind: cfg.kind,
      summary,
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

