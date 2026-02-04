import { NextResponse } from 'next/server';
import { Connection } from '@solana/web3.js';
import { extractIntentWithGemini } from '@/lib/gemini';
import { enforcePolicy } from '@/agent/policy';
import { JupiterManager } from '@/agent/jupiter';
import { getDb } from '@/lib/db';
import crypto from 'node:crypto';

const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export async function POST(req: Request) {
  try {
    const { prompt, execute = false, owner, includeQuote = false } = await req.json();
    if (!prompt) return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });

    const intent = await extractIntentWithGemini(prompt);
    const policy = await enforcePolicy(connection, owner, intent);
    if (!policy.ok) {
      return NextResponse.json(
        {
          prompt,
          intent,
          plan: [],
          blocked: true,
          reason: policy.reason,
          timestamp: Date.now(),
          agentFingerprint: 'IBRL-α-01',
        },
        { status: 400 }
      );
    }

    if (intent.kind === 'CHAT') {
      return NextResponse.json({
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
      });
    }

    if (intent.kind === 'UNSUPPORTED') {
      return NextResponse.json(
        {
          prompt,
          intent,
          plan: [],
          blocked: true,
          reason: intent.reason,
          timestamp: Date.now(),
          agentFingerprint: 'IBRL-α-01',
        },
        { status: 400 }
      );
    }

    const steps =
      intent.kind === 'SWAP'
        ? [
            {
              type: 'SWAP',
              description: `Swap ${intent.amount.value} SOL → USDC (slippage ${intent.slippageBps} bps)`,
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
    const inputMint = SOL_MINT;
    const outputMint = USDC_MINT;
    const amountLamports = Math.floor(intent.amount.value * 1_000_000_000);

    const quote = shouldFetchQuote
      ? await jupiter!.getQuote(inputMint, outputMint, amountLamports, intent.slippageBps)
      : null;
    if (shouldFetchQuote && !quote) {
      return NextResponse.json({ error: 'Failed to fetch swap quote' }, { status: 502 });
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
        return NextResponse.json({ error: 'Failed to build swap transaction' }, { status: 502 });
      }

      const simulation = await connection.simulateTransaction(swap.transaction, {
        sigVerify: false,
        commitment: 'processed',
      });

      const proposalId = crypto.randomUUID();
      const summary =
        intent.kind === 'SWAP'
          ? `Swap ${intent.amount.value} SOL → USDC`
          : `Exit ${intent.amount.value} SOL → USDC`;

      const db = getDb();
      const now = Date.now();
      db.prepare(
        `INSERT INTO proposals (id, owner, intent_id, kind, summary, quote_json, tx_base64, simulation_json, status, created_at, updated_at)
         VALUES (@id, @owner, NULL, @kind, @summary, @quote_json, @tx_base64, @simulation_json, 'PENDING_APPROVAL', @created_at, @updated_at)`
      ).run({
        id: proposalId,
        owner,
        kind: intent.kind,
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

      tx = {
        proposalId,
        swapTransactionBase64: swap.swapTransactionBase64,
        simulation,
        quote: {
          inAmount: quote.inAmount,
          outAmount: quote.outAmount,
          otherAmountThreshold: quote.otherAmountThreshold,
          priceImpactPct: quote.priceImpactPct,
        },
      };
    }

    return NextResponse.json({ 
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
        : intent.kind === 'PRICE_TRIGGER_EXIT'
          ? 'Parsed automation. Click “Save Automation” to arm it, or Simulate to validate the exit transaction.'
          : 'Parsed intent. Click Simulate to build and verify the transaction.',
      timestamp: Date.now(),
      agentFingerprint: 'IBRL-α-01'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse intent';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
