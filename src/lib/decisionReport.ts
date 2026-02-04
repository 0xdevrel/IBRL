import type { Intent } from '@/agent/intentSchema';
import type { PolicyResult } from '@/agent/policy';

type QuoteSummary = {
  inAmount: string;
  outAmount: string;
  otherAmountThreshold?: string;
  priceImpactPct?: string;
};

export type DecisionReport = {
  version: '1';
  generatedAt: number;
  owner: string;
  prompt: string;
  proposal: {
    kind: string;
    summary: string;
  };
  checks: {
    policy: { ok: boolean; reason?: string };
    simulation: { ok: boolean; err?: unknown };
  };
  quote?: QuoteSummary & {
    slippageBps: number;
    from: 'SOL' | 'USDC';
    to: 'SOL' | 'USDC';
    inHuman: string;
    outHuman: string;
    minOutHuman?: string;
  };
  risks: string[];
  scenarios: { ifPriceMovesPct: number; note: string }[];
  markdown: string;
};

function formatNumber(n: number, decimals: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function baseUnitsToHuman(amount: string, unit: 'SOL' | 'USDC') {
  const v = Number(amount);
  if (!Number.isFinite(v)) return amount;
  if (unit === 'SOL') return `${formatNumber(v / 1_000_000_000, 6)} SOL`;
  return `${formatNumber(v / 1_000_000, 2)} USDC`;
}

export function buildDecisionReport(args: {
  owner: string;
  prompt: string;
  intent: Intent;
  policy: PolicyResult;
  summary: string;
  quote: QuoteSummary | null;
  simulation: any | null;
  from: 'SOL' | 'USDC';
  to: 'SOL' | 'USDC';
}): DecisionReport {
  const generatedAt = Date.now();
  const simErr = args.simulation?.value?.err ?? null;
  const simOk = simErr == null;
  const slippageBps = 'slippageBps' in args.intent ? (args.intent as any).slippageBps : 50;

  const risks: string[] = [];
  if (args.intent.kind !== 'PORTFOLIO_QA' && args.intent.kind !== 'CHAT') {
    risks.push('Markets can move between simulation and send; expected output may change.');
    risks.push('Jupiter routing can change; the built transaction is a point-in-time route.');
    risks.push('Simulation uses commitment=processed and may not match finalized state.');
    if (slippageBps >= 75) risks.push(`Higher slippage (${slippageBps} bps) increases adverse execution risk.`);
    if (!simOk) risks.push('Simulation indicates this transaction will likely fail; do not send.');
  }

  const scenarios: DecisionReport['scenarios'] = [];
  if (args.quote) {
    const minOut = args.quote.otherAmountThreshold;
    scenarios.push({
      ifPriceMovesPct: -1,
      note: minOut
        ? `If price moves ~1% against you, the swap may execute closer to the minimum output (${baseUnitsToHuman(minOut, args.to)}).`
        : 'If price moves ~1% against you, expected output decreases and the swap may fail depending on slippage protection.',
    });
    scenarios.push({
      ifPriceMovesPct: +1,
      note: 'If price moves ~1% in your favor, you may receive more output, but the transaction still respects its fixed route + slippage bounds.',
    });
  } else {
    scenarios.push({ ifPriceMovesPct: -1, note: 'Price movement against you increases execution risk or worsens outcome.' });
    scenarios.push({ ifPriceMovesPct: +1, note: 'Price movement in your favor improves outcome; still confirm the route and fees.' });
  }

  const quoteBlock =
    args.quote
      ? [
          `**Quote (Jupiter):**`,
          `- In: \`${baseUnitsToHuman(args.quote.inAmount, args.from)}\``,
          `- Out (est.): \`${baseUnitsToHuman(args.quote.outAmount, args.to)}\``,
          args.quote.otherAmountThreshold ? `- Min out: \`${baseUnitsToHuman(args.quote.otherAmountThreshold, args.to)}\`` : null,
          args.quote.priceImpactPct ? `- Price impact: \`${args.quote.priceImpactPct}\`` : null,
          `- Slippage: \`${slippageBps} bps\``,
        ]
          .filter(Boolean)
          .join('\n')
      : null;

  const simBlock = [
    `**Simulation:** \`${simOk ? 'OK' : 'ERR'}\``,
    !simOk ? `- Error: \`${JSON.stringify(simErr)}\`` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const policyBlock = args.policy.ok
    ? `**Policy checks:** \`PASS\``
    : `**Policy checks:** \`BLOCKED\` — ${'reason' in args.policy ? args.policy.reason : 'Unknown reason'}`;

  const whyNow =
    args.intent.kind === 'PRICE_TRIGGER_EXIT' || args.intent.kind === 'PRICE_TRIGGER_ENTRY' || args.intent.kind === 'DCA_SWAP'
      ? 'You are arming an automation; the agent will only propose actions when conditions are met, and you will still approve each send.'
      : 'You requested a one-off action and asked the agent to produce a real, signable transaction.';

  const markdown = [
    `### Decision Report`,
    ``,
    `**Proposal:** ${args.summary}`,
    `- Kind: \`${args.intent.kind}\``,
    `- From → To: \`${args.from} → ${args.to}\``,
    ``,
    `**Why this action**`,
    `- Derived from your intent: \`${args.prompt}\``,
    ``,
    `**Why now**`,
    `- ${whyNow}`,
    ``,
    policyBlock,
    ``,
    simBlock,
    ``,
    quoteBlock,
    ``,
    `**Risks**`,
    ...risks.map((r) => `- ${r}`),
    ``,
    `**What changes if price moves**`,
    ...scenarios.map((s) => `- ${s.ifPriceMovesPct > 0 ? '+' : ''}${s.ifPriceMovesPct}%: ${s.note}`),
    ``,
    `**Approval gate**`,
    `- Nothing is broadcast until you approve in-wallet.`,
  ]
    .filter((l) => l !== null)
    .join('\n');

  return {
    version: '1',
    generatedAt,
    owner: args.owner,
    prompt: args.prompt,
    proposal: {
      kind: args.intent.kind,
      summary: args.summary,
    },
    checks: {
      policy: args.policy.ok ? { ok: true } : { ok: false, reason: (args.policy as any).reason },
      simulation: simOk ? { ok: true } : { ok: false, err: simErr },
    },
    quote: args.quote
      ? {
          ...args.quote,
          slippageBps,
          from: args.from,
          to: args.to,
          inHuman: baseUnitsToHuman(args.quote.inAmount, args.from),
          outHuman: baseUnitsToHuman(args.quote.outAmount, args.to),
          minOutHuman: args.quote.otherAmountThreshold ? baseUnitsToHuman(args.quote.otherAmountThreshold, args.to) : undefined,
        }
      : undefined,
    risks,
    scenarios,
    markdown,
  };
}
