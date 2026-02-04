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
  if (lower.startsWith('swap') || lower.startsWith('exit') || lower.startsWith('sell') || lower.startsWith('convert')) {
    return {
      kind: 'UNSUPPORTED',
      reason: 'Missing destination. Try: "Swap 0.1 SOL to USDC".',
    };
  }

  return {
    kind: 'UNSUPPORTED',
    reason: 'Could not interpret intent. Try: "Swap 0.1 SOL to USDC" or "Exit 0.25 SOL to USDC".',
  };
}

