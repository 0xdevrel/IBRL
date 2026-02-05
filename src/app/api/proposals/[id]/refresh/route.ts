import { NextResponse } from 'next/server';
import { Connection } from '@solana/web3.js';
import crypto from 'node:crypto';
import { getDb } from '@/lib/db';
import { enforcePolicy } from '@/agent/policy';
import { JupiterManager } from '@/agent/jupiter';
import { buildDecisionReport } from '@/lib/decisionReport';
import type { Intent } from '@/agent/intentSchema';

export const runtime = 'nodejs';

const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_DECIMALS = 6;

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

function amountToBaseUnits(amount: { value: number; unit: 'SOL' | 'USDC' }) {
  if (amount.unit === 'SOL') return Math.floor(amount.value * 1_000_000_000 + 1e-8);
  return Math.floor(amount.value * 10 ** USDC_DECIMALS + 1e-8);
}

function getMintsForSwap(from: 'SOL' | 'USDC', to: 'SOL' | 'USDC') {
  const inputMint = from === 'SOL' ? SOL_MINT : USDC_MINT;
  const outputMint = to === 'SOL' ? SOL_MINT : USDC_MINT;
  return { inputMint, outputMint };
}

function getSwapPair(intent: Intent): { from: 'SOL' | 'USDC'; to: 'SOL' | 'USDC' } | null {
  if (intent.kind === 'SWAP' || intent.kind === 'DCA_SWAP') return { from: intent.from, to: intent.to };
  if (intent.kind === 'PRICE_TRIGGER_ENTRY') return { from: 'USDC', to: 'SOL' };
  if (intent.kind === 'PRICE_TRIGGER_EXIT' || intent.kind === 'EXIT_TO_USDC') return { from: 'SOL', to: 'USDC' };
  return null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as any;
  const owner = body?.owner ? String(body.owner).trim() : '';
  if (!owner) return NextResponse.json({ error: 'owner required' }, { status: 400 });

  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, owner, kind, summary, intent_json, status
       FROM proposals
       WHERE id = ? AND owner = ?`
    )
    .get(id, owner) as any | undefined;

  if (!row) return NextResponse.json({ error: 'proposal not found' }, { status: 404 });
  if (row.status !== 'PENDING_APPROVAL') {
    return NextResponse.json({ ok: true, id, status: row.status, message: 'Proposal not pending; no refresh required.' });
  }

  let intent: Intent | null = null;
  try {
    intent = row.intent_json ? (JSON.parse(row.intent_json) as Intent) : null;
  } catch {
    intent = null;
  }
  if (!intent) return NextResponse.json({ error: 'intent not recorded for this proposal' }, { status: 400 });

  const pair = getSwapPair(intent);
  if (!pair) return NextResponse.json({ error: 'proposal kind is not refreshable' }, { status: 400 });

  const policy = await enforcePolicy(connection, owner, intent);
  if (!policy.ok) return NextResponse.json({ error: policy.reason }, { status: 400 });

  const jupiter = new JupiterManager(connection);
  const { inputMint, outputMint } = getMintsForSwap(pair.from, pair.to);
  const amountBaseUnits = amountToBaseUnits((intent as any).amount);

  const quote = await jupiter.getQuote(inputMint, outputMint, amountBaseUnits, (intent as any).slippageBps ?? 50);
  if (!quote) return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 502 });

  const swap = await jupiter.swap(quote, owner);
  if (!swap) return NextResponse.json({ error: 'Failed to build swap transaction' }, { status: 502 });

  const simulation = await connection.simulateTransaction(swap.transaction, { sigVerify: false, commitment: 'processed' });

  const decisionReport = buildDecisionReport({
    owner,
    prompt: `REFRESH: ${row.summary}`,
    intent,
    policy,
    summary: row.summary,
    quote: {
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      otherAmountThreshold: quote.otherAmountThreshold,
      priceImpactPct: quote.priceImpactPct,
      route: extractRouteSummary(quote) || undefined,
    },
    simulation,
    from: pair.from,
    to: pair.to,
  });

  const now = Date.now();
  db.prepare(
    `UPDATE proposals
     SET quote_json = ?, tx_base64 = ?, simulation_json = ?, decision_report_json = ?, updated_at = ?
     WHERE id = ? AND owner = ?`
  ).run(
    JSON.stringify({
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      otherAmountThreshold: quote.otherAmountThreshold,
      priceImpactPct: quote.priceImpactPct,
      route: extractRouteSummary(quote) || undefined,
    }),
    swap.swapTransactionBase64,
    JSON.stringify(simulation),
    JSON.stringify(decisionReport),
    now,
    id,
    owner
  );

  return NextResponse.json({
    ok: true,
    id,
    refreshedAt: now,
    tx: {
      swapTransactionBase64: swap.swapTransactionBase64,
      simulation,
      quote: {
        inAmount: quote.inAmount,
        outAmount: quote.outAmount,
        otherAmountThreshold: quote.otherAmountThreshold,
        priceImpactPct: quote.priceImpactPct,
      },
    },
    decisionReport,
    nonce: crypto.randomUUID(),
  });
}
