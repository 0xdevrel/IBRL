import type { Intent } from '@/agent/intentSchema';

function isGreeting(text: string) {
  const t = text.trim().toLowerCase();
  return (
    t === 'hi' ||
    t === 'hello' ||
    t === 'hey' ||
    t.startsWith('hi ') ||
    t.startsWith('hello ') ||
    t.startsWith('hey ')
  );
}

function normalizeAsset(asset: string): 'SOL' | 'USDC' | null {
  const a = asset.trim().toUpperCase();
  if (a === 'SOL') return 'SOL';
  if (a === 'USDC') return 'USDC';
  if (a === 'USD') return 'USDC';
  return null;
}

function parseIntervalMinutes(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (s === 'hourly') return 60;
  if (s === 'daily') return 1440;
  const m = s.match(/^(\d+)\s*(m|min|mins|minute|minutes)$/);
  if (m) return Number(m[1]);
  const h = s.match(/^(\d+)\s*(h|hr|hrs|hour|hours)$/);
  if (h) return Number(h[1]) * 60;
  const d = s.match(/^(\d+)\s*(d|day|days)$/);
  if (d) return Number(d[1]) * 1440;
  return null;
}

export function parseIntentLocally(prompt: string): Intent {
  if (isGreeting(prompt)) {
    return { kind: 'CHAT', message: 'Hello. Give me an intent like: “Swap 0.1 SOL to USDC”.' };
  }

  const text = prompt.trim();
  const lower = text.toLowerCase();

  // Triggered protection pattern examples:
  // "protect 0.25 sol if sol drops below 95"
  // "exit 0.25 sol if sol < 90"
  // "if sol drops below $95 exit 0.25 sol to usdc"
  const triggerRegex1 =
    /^(?:protect|hedge)\s+(\d+(?:\.\d+)?)\s*(sol)\s+.*?(?:if|when).*(?:sol).*(?:below|under|<)\s*\$?(\d+(?:\.\d+)?)/i;
  const triggerRegex2 =
    /^(?:exit)\s+(\d+(?:\.\d+)?)\s*(sol)\s+.*?(?:if|when).*(?:sol).*(?:below|under|<)\s*\$?(\d+(?:\.\d+)?)/i;
  const triggerRegex3 =
    /^(?:if|when)\s+sol\s+.*?(?:below|under|<)\s*\$?(\d+(?:\.\d+)?)\s*,?\s*(?:then\s*)?(?:exit|protect)\s+(\d+(?:\.\d+)?)\s*(sol)\b/i;

  const t1 = text.match(triggerRegex1);
  if (t1) {
    const amount = Number(t1[1]);
    const thresholdUsd = Number(t1[3]);
    return {
      kind: 'PRICE_TRIGGER_EXIT',
      amount: { value: amount, unit: 'SOL' },
      thresholdUsd,
      slippageBps: 50,
    };
  }
  const t2 = text.match(triggerRegex2);
  if (t2) {
    const amount = Number(t2[1]);
    const thresholdUsd = Number(t2[3]);
    return {
      kind: 'PRICE_TRIGGER_EXIT',
      amount: { value: amount, unit: 'SOL' },
      thresholdUsd,
      slippageBps: 50,
    };
  }
  const t3 = text.match(triggerRegex3);
  if (t3) {
    const thresholdUsd = Number(t3[1]);
    const amount = Number(t3[2]);
    return {
      kind: 'PRICE_TRIGGER_EXIT',
      amount: { value: amount, unit: 'SOL' },
      thresholdUsd,
      slippageBps: 50,
    };
  }

  // Triggered entry pattern examples:
  // "buy sol with 10 usdc if sol drops below 95"
  // "enter 25 usdc to sol when sol < 90"
  const entryRegex1 =
    /^(?:buy|enter)\s+(\d+(?:\.\d+)?)\s*(usdc|usd)\s*(?:to|->)\s*(sol)\s+.*?(?:if|when).*(?:sol).*(?:below|under|<)\s*\$?(\d+(?:\.\d+)?)/i;
  const entryRegexWith =
    /^(?:buy)\s+(sol)\s+with\s+(\d+(?:\.\d+)?)\s*(usdc|usd)\s+.*?(?:if|when).*(?:sol).*(?:below|under|<)\s*\$?(\d+(?:\.\d+)?)/i;
  const entryRegex2 =
    /^(?:if|when)\s+sol\s+.*?(?:below|under|<)\s*\$?(\d+(?:\.\d+)?)\s*,?\s*(?:then\s*)?(?:buy|enter)\s+(\d+(?:\.\d+)?)\s*(usdc|usd)\s*(?:to|->)\s*(sol)\b/i;

  const e1 = text.match(entryRegex1);
  if (e1) {
    const amount = Number(e1[1]);
    const thresholdUsd = Number(e1[4]);
    return {
      kind: 'PRICE_TRIGGER_ENTRY',
      amount: { value: amount, unit: 'USDC' },
      thresholdUsd,
      slippageBps: 50,
    };
  }
  const ew = text.match(entryRegexWith);
  if (ew) {
    const amount = Number(ew[2]);
    const thresholdUsd = Number(ew[4]);
    return {
      kind: 'PRICE_TRIGGER_ENTRY',
      amount: { value: amount, unit: 'USDC' },
      thresholdUsd,
      slippageBps: 50,
    };
  }
  const e2 = text.match(entryRegex2);
  if (e2) {
    const thresholdUsd = Number(e2[1]);
    const amount = Number(e2[2]);
    return {
      kind: 'PRICE_TRIGGER_ENTRY',
      amount: { value: amount, unit: 'USDC' },
      thresholdUsd,
      slippageBps: 50,
    };
  }

  // DCA pattern examples:
  // "dca 5 usdc to sol every 60 minutes"
  // "dca 0.05 sol to usdc every 1h"
  const dcaRegex =
    /^(?:dca)\s+(\d+(?:\.\d+)?)\s*(sol|usdc|usd)\s*(?:to|->)\s*(sol|usdc|usd)\s+every\s+([a-z0-9 ]+)$/i;
  const dcaMatch = text.match(dcaRegex);
  if (dcaMatch) {
    const value = Number(dcaMatch[1]);
    const from = normalizeAsset(dcaMatch[2]);
    const to = normalizeAsset(dcaMatch[3]);
    const intervalMinutes = parseIntervalMinutes(dcaMatch[4] || '');
    if (!from || !to) {
      return { kind: 'UNSUPPORTED', reason: 'Unsupported assets. Only SOL and USDC are allowed.' };
    }
    if (!intervalMinutes || !Number.isFinite(intervalMinutes)) {
      return { kind: 'UNSUPPORTED', reason: 'Invalid interval. Try: "every 60 minutes" or "every 1h".' };
    }
    return {
      kind: 'DCA_SWAP',
      from,
      to,
      amount: { value, unit: from },
      intervalMinutes,
      slippageBps: 50,
    };
  }

  // Swap pattern examples:
  // "swap 0.1 sol to usdc"
  // "swap 0.1 SOL -> USD"
  // "exit 0.25 sol to usdc"
  const swapRegex =
    /^(swap|sell|convert)\s+(\d+(?:\.\d+)?)\s*(sol|usdc|usd)\s*(?:to|->)\s*(sol|usdc|usd)\b/i;
  const exitRegex = /^(exit)\s+(\d+(?:\.\d+)?)\s*(sol)\s*(?:to|->)\s*(usdc|usd)?\b/i;

  const swapMatch = text.match(swapRegex);
  if (swapMatch) {
    const amount = Number(swapMatch[2]);
    const from = normalizeAsset(swapMatch[3]) ?? 'SOL';
    const to = normalizeAsset(swapMatch[4]) ?? 'USDC';
    return {
      kind: 'SWAP',
      from,
      to,
      amount: { value: amount, unit: from },
      slippageBps: 50,
    };
  }

  const exitMatch = text.match(exitRegex);
  if (exitMatch) {
    const amount = Number(exitMatch[2]);
    return {
      kind: 'EXIT_TO_USDC',
      amount: { value: amount, unit: 'SOL' },
      slippageBps: 50,
    };
  }

  // Portfolio questions / fund-manager style Q&A (non-execution).
  const looksLikeQuestion =
    lower.includes('?') ||
    lower.startsWith('what ') ||
    lower.startsWith('how ') ||
    lower.startsWith('should ') ||
    lower.startsWith('can you ') ||
    lower.startsWith('help ') ||
    lower.includes('balance') ||
    lower.includes('portfolio') ||
    lower.includes('invest') ||
    lower.includes('strategy') ||
    lower.includes('allocation') ||
    lower.includes('risk');
  if (looksLikeQuestion) {
    return { kind: 'PORTFOLIO_QA', question: text };
  }

  // Handle shorthand like: "swap 0.1 sol" -> treat as unsupported (missing destination).
  if (
    lower.startsWith('swap') ||
    lower.startsWith('exit') ||
    lower.startsWith('sell') ||
    lower.startsWith('convert') ||
    lower.startsWith('protect') ||
    lower.startsWith('hedge') ||
    lower.startsWith('dca') ||
    lower.startsWith('buy') ||
    lower.startsWith('enter') ||
    lower.startsWith('if ')
  ) {
    return {
      kind: 'UNSUPPORTED',
      reason:
        'Could not interpret. Try: "Swap 0.1 SOL to USDC", "Swap 10 USDC to SOL", "Protect 0.25 SOL if SOL drops below 95", or "DCA 5 USDC to SOL every 1h".',
    };
  }

  return {
    kind: 'UNSUPPORTED',
    reason: 'Could not interpret intent. Try: "Swap 0.1 SOL to USDC" or "Exit 0.25 SOL to USDC".',
  };
}
