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

  // Swap pattern examples:
  // "swap 0.1 sol to usdc"
  // "swap 0.1 SOL -> USD"
  // "exit 0.25 sol to usdc"
  const swapRegex =
    /^(swap|sell|convert)\s+(\d+(?:\.\d+)?)\s*(sol)\s*(?:to|->)\s*(usdc|usd)\b/i;
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
      amount: { value: amount, unit: 'SOL' },
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

  // Handle shorthand like: "swap 0.1 sol" -> treat as unsupported (missing destination).
  if (
    lower.startsWith('swap') ||
    lower.startsWith('exit') ||
    lower.startsWith('sell') ||
    lower.startsWith('convert') ||
    lower.startsWith('protect') ||
    lower.startsWith('hedge') ||
    lower.startsWith('if ')
  ) {
    return {
      kind: 'UNSUPPORTED',
      reason:
        'Could not interpret. Try: "Swap 0.1 SOL to USDC" or "Protect 0.25 SOL if SOL drops below 95".',
    };
  }

  return {
    kind: 'UNSUPPORTED',
    reason: 'Could not interpret intent. Try: "Swap 0.1 SOL to USDC" or "Exit 0.25 SOL to USDC".',
  };
}
