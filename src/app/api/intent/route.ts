import { NextResponse } from 'next/server';
import { Connection } from '@solana/web3.js';
import { extractIntentWithGemini } from '@/lib/gemini';
import { enforcePolicy } from '@/agent/policy';
import { JupiterManager } from '@/agent/jupiter';
import { getDb } from '@/lib/db';
import { getPortfolioSnapshot } from '@/lib/portfolioSnapshot';
import { generatePortfolioAnswer } from '@/lib/portfolioAdvisor';
import { buildDecisionReport } from '@/lib/decisionReport';
import crypto from 'node:crypto';

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

function logInteraction(args: { owner?: string; prompt: string; execute: boolean; ok: boolean; payload: unknown }) {
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO interactions (id, owner, prompt, execute, ok, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      args.owner || null,
      args.prompt,
      args.execute ? 1 : 0,
      args.ok ? 1 : 0,
      JSON.stringify(args.payload),
      Date.now()
    );
  } catch {
    // best-effort only
  }
}

export async function POST(req: Request) {
  try {
    const { prompt, execute = false, owner, includeQuote = false } = await req.json();
    if (!prompt) {
      const payload = { error: 'No prompt provided' };
      logInteraction({ owner, prompt: '', execute: Boolean(execute), ok: false, payload });
      return NextResponse.json(payload, { status: 400 });
    }

    const intent = await extractIntentWithGemini(prompt);
    const policy = await enforcePolicy(connection, owner, intent);
    if (!policy.ok) {
      const payload = {
        prompt,
        intent,
        plan: [],
        blocked: true,
        reason: policy.reason,
        timestamp: Date.now(),
        agentFingerprint: 'IBRL-α-01',
      };
      logInteraction({ owner, prompt, execute: Boolean(execute), ok: false, payload });
      return NextResponse.json(payload, { status: 400 });
    }

    if (intent.kind === 'CHAT') {
      const payload = {
        prompt,
        intent,
        plan: [
          {
            type: 'CHAT',
            description: intent.message,
            params: {},
            status: 'READY',
            timestamp: Date.now(),
          },
        ],
        tx: null,
        agentReply: intent.message,
        timestamp: Date.now(),
        agentFingerprint: 'IBRL-α-01',
      };
      logInteraction({ owner, prompt, execute: Boolean(execute), ok: true, payload });
      return NextResponse.json(payload);
    }

    if (intent.kind === 'PORTFOLIO_QA') {
      if (!owner) {
        const payload = { prompt, intent, blocked: true, reason: 'Wallet not connected' };
        logInteraction({ owner, prompt, execute: Boolean(execute), ok: false, payload });
        return NextResponse.json(payload, { status: 400 });
      }

      const snapshot = await getPortfolioSnapshot(connection, owner);
      const reply = await generatePortfolioAnswer(intent.question, snapshot);
      const payload = {
        prompt,
        intent,
        plan: [
          {
            type: 'ANALYZE',
            description: 'Portfolio analysis and strategy guidance (non-custodial, no auto-trades).',
            params: { snapshot },
            status: 'READY',
            timestamp: Date.now(),
          },
        ],
        tx: null,
        quote: null,
        portfolio: snapshot,
        agentReply: reply,
        timestamp: Date.now(),
        agentFingerprint: 'IBRL-α-01',
      };
      logInteraction({ owner, prompt, execute: Boolean(execute), ok: true, payload });
      return NextResponse.json(payload);
    }

    if (intent.kind === 'UNSUPPORTED') {
      const payload = {
        prompt,
        intent,
        plan: [],
        blocked: true,
        reason: intent.reason,
        timestamp: Date.now(),
        agentFingerprint: 'IBRL-α-01',
      };
      logInteraction({ owner, prompt, execute: Boolean(execute), ok: false, payload });
      return NextResponse.json(payload, { status: 400 });
    }

    const steps =
      intent.kind === 'SWAP'
        ? [
            {
              type: 'SWAP',
              description: `Swap ${intent.amount.value} ${intent.amount.unit} → ${intent.to} (slippage ${intent.slippageBps} bps)`,
              params: intent,
            },
          ]
      : intent.kind === 'PRICE_TRIGGER_EXIT'
          ? [
              {
                type: 'ARM_TRIGGER',
                description: `Arm: exit ${intent.amount.value} SOL → USDC when SOL/USD ≤ $${intent.thresholdUsd} (slippage ${intent.slippageBps} bps)`,
                params: intent,
              },
            ]
          : intent.kind === 'PRICE_TRIGGER_ENTRY'
            ? [
                {
                  type: 'ARM_TRIGGER',
                  description: `Arm: buy SOL with ${intent.amount.value} USDC when SOL/USD ≤ $${intent.thresholdUsd} (slippage ${intent.slippageBps} bps)`,
                  params: intent,
                },
              ]
            : intent.kind === 'DCA_SWAP'
              ? [
                  {
                    type: 'ARM_SCHEDULE',
                    description: `Arm: swap ${intent.amount.value} ${intent.amount.unit} ${intent.from} → ${intent.to} every ${intent.intervalMinutes} minutes (slippage ${intent.slippageBps} bps)`,
                    params: intent,
                  },
                ]
          : [
              {
                type: 'EXIT',
                description: `Exit ${intent.amount.value} SOL → USDC (slippage ${intent.slippageBps} bps)`,
                params: intent,
              },
            ];

    const plan = steps.map((s) => ({
      ...s,
      status: 'READY',
      timestamp: Date.now(),
    }));

    // Parsing should be fast; only fetch quotes when simulating/executing (or if explicitly requested).
    const shouldFetchQuote = Boolean(execute || includeQuote);
    const jupiter = shouldFetchQuote ? new JupiterManager(connection) : null;
    const swapFrom =
      intent.kind === 'SWAP' || intent.kind === 'DCA_SWAP'
        ? intent.from
        : intent.kind === 'PRICE_TRIGGER_ENTRY'
          ? 'USDC'
          : 'SOL';
    const swapTo =
      intent.kind === 'SWAP' || intent.kind === 'DCA_SWAP'
        ? intent.to
        : intent.kind === 'PRICE_TRIGGER_ENTRY'
          ? 'SOL'
          : 'USDC';

    const { inputMint, outputMint } = getMintsForSwap(swapFrom, swapTo);
    const amountBaseUnits = amountToBaseUnits(intent.amount as any);

    const quote = shouldFetchQuote
      ? await jupiter!.getQuote(inputMint, outputMint, amountBaseUnits, intent.slippageBps)
      : null;
    if (shouldFetchQuote && !quote) {
      const payload = { error: 'Failed to fetch swap quote' };
      logInteraction({ owner, prompt, execute: Boolean(execute), ok: false, payload });
      return NextResponse.json(payload, { status: 502 });
    }

    let tx = null as null | {
      proposalId?: string;
      swapTransactionBase64: string;
      simulation: any;
      quote: any;
    };

    if (execute) {
      if (!owner) return NextResponse.json({ error: 'Owner wallet required for execution' }, { status: 400 });

      const swap = await jupiter!.swap(quote!, owner);
      if (!swap) {
        const payload = { error: 'Failed to build swap transaction' };
        logInteraction({ owner, prompt, execute: true, ok: false, payload });
        return NextResponse.json(payload, { status: 502 });
      }

      const simulation = await connection.simulateTransaction(swap.transaction, {
        sigVerify: false,
        commitment: 'processed',
      });

      const proposalId = crypto.randomUUID();
      const summary =
        intent.kind === 'SWAP'
          ? `Swap ${intent.amount.value} ${intent.from} → ${intent.to}`
          : intent.kind === 'PRICE_TRIGGER_ENTRY'
            ? `Buy SOL with ${intent.amount.value} USDC`
            : `Exit ${intent.amount.value} SOL → USDC`;

      const db = getDb();
      const now = Date.now();
      const decisionReport = buildDecisionReport({
        owner,
        prompt,
        intent,
        policy,
        summary,
        quote: quote
          ? {
              inAmount: quote.inAmount,
              outAmount: quote.outAmount,
              otherAmountThreshold: quote.otherAmountThreshold,
              priceImpactPct: quote.priceImpactPct,
              route: extractRouteSummary(quote) || undefined,
            }
          : null,
        simulation,
        from: swapFrom as any,
        to: swapTo as any,
      });
      db.prepare(
        `INSERT INTO proposals (id, owner, intent_id, kind, summary, intent_json, quote_json, tx_base64, simulation_json, decision_report_json, created_by, status, created_at, updated_at)
         VALUES (@id, @owner, NULL, @kind, @summary, @intent_json, @quote_json, @tx_base64, @simulation_json, @decision_report_json, @created_by, 'PENDING_APPROVAL', @created_at, @updated_at)`
      ).run({
        id: proposalId,
        owner,
        kind: intent.kind,
        summary,
        intent_json: JSON.stringify(intent),
        decision_report_json: JSON.stringify(decisionReport),
        created_by: 'user',
        quote_json: JSON.stringify({
          inAmount: quote!.inAmount,
          outAmount: quote!.outAmount,
          otherAmountThreshold: quote!.otherAmountThreshold,
          priceImpactPct: quote!.priceImpactPct,
          route: extractRouteSummary(quote!) || undefined,
        }),
        tx_base64: swap.swapTransactionBase64,
        simulation_json: JSON.stringify(simulation),
        created_at: now,
        updated_at: now,
      });

      tx = {
        proposalId,
        swapTransactionBase64: swap.swapTransactionBase64,
        simulation,
        quote: {
          inAmount: quote!.inAmount,
          outAmount: quote!.outAmount,
          otherAmountThreshold: quote!.otherAmountThreshold,
          priceImpactPct: quote!.priceImpactPct,
        },
      };
    }

    const payload = { 
      prompt,
      plan,
      intent,
      quote: quote
        ? {
            inAmount: quote.inAmount,
            outAmount: quote.outAmount,
            otherAmountThreshold: quote.otherAmountThreshold,
            priceImpactPct: quote.priceImpactPct,
          }
        : null,
      tx,
      agentReply: execute
        ? 'Simulation built. Approve in-wallet to send.'
        : intent.kind === 'PRICE_TRIGGER_EXIT' || intent.kind === 'PRICE_TRIGGER_ENTRY' || intent.kind === 'DCA_SWAP'
          ? 'Parsed automation. Click “Save Automation” to arm it, or Simulate to validate the transaction.'
          : 'Parsed intent. Click Simulate to build and verify the transaction.',
      timestamp: Date.now(),
      agentFingerprint: 'IBRL-α-01'
    };
    logInteraction({ owner, prompt, execute: Boolean(execute), ok: true, payload });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse intent';
    const payload = { error: message };
    logInteraction({ prompt: 'unknown', execute: false, ok: false, payload });
    return NextResponse.json(payload, { status: 500 });
  }
}
