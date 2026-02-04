import type { PortfolioSnapshot } from '@/lib/portfolioSnapshot';

function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  return key;
}

function getGeminiModel(): string {
  return (process.env.GEMINI_MODEL?.trim() || 'gemini-3-flash-preview').trim();
}

function getGeminiBaseUrl(): string {
  return (process.env.GEMINI_API_BASE_URL?.trim() || 'https://generativelanguage.googleapis.com/v1beta').trim();
}

function buildAdvisorSystemPrompt() {
  return `
You are IBRL-agent acting as a careful, professional fund manager assistant for a Solana user.

You are given a user's on-chain snapshot (SOL and USDC balances) and optionally SOL/USD price and epoch.
Answer the user's question with:
- A quick "Portfolio Snapshot" section that repeats ONLY the provided numbers (never invent).
- A "Risk Framing" section describing key risks (volatility, fees, slippage, execution drift).
- A "Options" section with 2-3 approaches (conservative/balanced/aggressive). Use qualitative guidance; do NOT promise returns.
- A "Next Actions in IBRL" section that maps to supported intents (swap, exit, protect, buy dip, dca).

Hard rules:
- Do not provide guarantees, predicted returns, or fake APYs.
- Do not claim you executed anything.
- Always remind that any trade requires simulation + explicit wallet approval.
- If price is null, say price feed is unavailable and avoid price-based conclusions.
`.trim();
}

export async function generatePortfolioAnswer(question: string, snapshot: PortfolioSnapshot): Promise<string> {
  // If Gemini is unavailable, return a deterministic, non-fake answer.
  if (!process.env.GEMINI_API_KEY?.trim()) {
    return fallbackAnswer(question, snapshot);
  }

  const key = getGeminiApiKey();
  const model = getGeminiModel();
  const base = getGeminiBaseUrl();
  const url = `${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

  const context = {
    snapshot,
    question,
    supportedIntents: [
      'Swap X SOL to USDC',
      'Swap X USDC to SOL',
      'Exit X SOL to USDC',
      'Protect X SOL if SOL drops below Y',
      'Buy SOL with X USDC if SOL drops below Y',
      'DCA X USDC to SOL every Nh',
    ],
  };

  const body = {
    systemInstruction: { role: 'system', parts: [{ text: buildAdvisorSystemPrompt() }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(context) }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 700,
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return fallbackAnswer(question, snapshot);
    const json = (await res.json()) as any;
    const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return fallbackAnswer(question, snapshot);
    return text.trim();
  } catch {
    return fallbackAnswer(question, snapshot);
  }
}

function fallbackAnswer(question: string, snapshot: PortfolioSnapshot) {
  const priceLine =
    typeof snapshot.solUsdPrice === 'number' && Number.isFinite(snapshot.solUsdPrice)
      ? `SOL/USD: $${snapshot.solUsdPrice.toFixed(2)}`
      : 'SOL/USD: (unavailable)';
  const epochLine = snapshot.epoch != null ? `Epoch: ${snapshot.epoch}` : 'Epoch: (unavailable)';

  return [
    `Portfolio Snapshot`,
    `- SOL: ${snapshot.solBalance.toFixed(4)}`,
    `- USDC: ${snapshot.usdcBalance.toFixed(2)}`,
    `- ${priceLine}`,
    `- ${epochLine}`,
    ``,
    `Question`,
    `- ${question}`,
    ``,
    `Risk Framing`,
    `- Crypto assets are volatile; consider sizing and drawdown tolerance.`,
    `- Swaps have fees, slippage, and execution drift between simulation and broadcast.`,
    ``,
    `Options (educational, not financial advice)`,
    `- Conservative: reduce exposure with "Exit X SOL to USDC" and keep most in USDC.`,
    `- Balanced: small DCA into SOL (e.g., "DCA X USDC to SOL every 1h") with tight sizing.`,
    `- Aggressive: keep more SOL and use a protection trigger (e.g., "Protect X SOL if SOL drops below Y").`,
    ``,
    `Next Actions in IBRL`,
    `- Parse → Simulate → Approve & Send (wallet signature required for any trade).`,
  ].join('\n');
}
