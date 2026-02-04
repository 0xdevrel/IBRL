import { Intent, IntentSchema } from '@/agent/intentSchema';
import { parseIntentLocally } from '@/agent/localIntent';

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

function buildSystemPrompt() {
  return `
You are IBRL-agent's intent extraction engine.

Goal: Convert a human prompt into a single JSON object matching one of these intents:
- CHAT: if the user greets or asks smalltalk (e.g., "hi", "hello"). Provide a short friendly reply in "message".
- PRICE_TRIGGER_EXIT: a protective automation. When SOL/USD is <= thresholdUsd, propose an exit of a specific SOL amount to USDC. This is a proposal only; execution always requires wallet approval.
- SWAP: swap between SOL and USDC. ONLY support unit SOL for now.
- EXIT_TO_USDC: swap SOL -> USDC for a specified SOL amount. ONLY support unit SOL for now.
- UNSUPPORTED: if the user asks for anything else (yield strategies, leverage, Kamino operations, unknown tokens, price targets, etc).

Rules:
- Output MUST be valid JSON only (no markdown, no comments).
- Use slippageBps default 50 unless user specifies.
- If user doesn't specify direction/token pair clearly, return UNSUPPORTED with a short reason.
- Never invent balances, prices, or chain state.
`.trim();
}

export async function extractIntentWithGemini(prompt: string): Promise<Intent> {
  // Fast local parse for common intents (reliable even if the model is down).
  const local = parseIntentLocally(prompt);
  if (local.kind !== 'UNSUPPORTED') return local;

  const key = getGeminiApiKey();
  const model = getGeminiModel();
  const base = getGeminiBaseUrl();

  const url = `${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

  const body = {
    systemInstruction: { role: 'system', parts: [{ text: buildSystemPrompt() }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 256,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // Fall back to deterministic parsing if Gemini fails.
    return local;
  }

  const json = (await res.json()) as any;
  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return local;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Try to extract a JSON object substring (models sometimes wrap output).
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      try {
        parsed = JSON.parse(text.slice(first, last + 1));
      } catch {
        parsed = undefined;
      }
    }
  }

  if (parsed === undefined) {
    // One retry with stricter constraint.
    const retryBody = {
      ...body,
      contents: [
        ...body.contents,
        {
          role: 'user',
          parts: [{ text: 'Return ONLY a valid JSON object that matches the schema. No extra text.' }],
        },
      ],
    };
    const retryRes = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(retryBody),
    });
    if (!retryRes.ok) {
      const retryText = await retryRes.text().catch(() => '');
      throw new Error(`Gemini retry error: HTTP ${retryRes.status} ${retryText.slice(0, 200)}`);
    }
    const retryJson = (await retryRes.json()) as any;
    const retryOut: string | undefined = retryJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!retryOut) return local;
    try {
      parsed = JSON.parse(retryOut);
    } catch {
      const f = retryOut.indexOf('{');
      const l = retryOut.lastIndexOf('}');
      if (f !== -1 && l !== -1 && l > f) {
        parsed = JSON.parse(retryOut.slice(f, l + 1));
      } else {
        return local;
      }
    }
  }

  const normalized = normalizeGeminiIntent(parsed);
  const validated = IntentSchema.safeParse(normalized);
  if (!validated.success) {
    return local;
  }
  return validated.data;
}

function normalizeGeminiIntent(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;

  // Normalize asset aliases.
  const normalizeAsset = (v: any) => {
    const s = String(v || '').trim().toUpperCase();
    if (s === 'USD') return 'USDC';
    return s;
  };

  if (raw.kind === 'PRICE_TRIGGER_EXIT') {
    return {
      kind: 'PRICE_TRIGGER_EXIT',
      amount: {
        value: typeof raw.amount?.value === 'string' ? Number(raw.amount.value) : raw.amount?.value,
        unit: 'SOL',
      },
      thresholdUsd:
        typeof raw.thresholdUsd === 'string' ? Number(raw.thresholdUsd) : raw.thresholdUsd,
      slippageBps: raw.slippageBps ?? 50,
    };
  }

  if (raw.kind === 'SWAP') {
    return {
      kind: 'SWAP',
      from: normalizeAsset(raw.from),
      to: normalizeAsset(raw.to),
      amount: {
        value: typeof raw.amount?.value === 'string' ? Number(raw.amount.value) : raw.amount?.value,
        unit: 'SOL',
      },
      slippageBps: raw.slippageBps ?? 50,
    };
  }

  if (raw.kind === 'EXIT_TO_USDC') {
    return {
      kind: 'EXIT_TO_USDC',
      amount: {
        value: typeof raw.amount?.value === 'string' ? Number(raw.amount.value) : raw.amount?.value,
        unit: 'SOL',
      },
      slippageBps: raw.slippageBps ?? 50,
    };
  }

  if (raw.kind === 'CHAT') {
    return { kind: 'CHAT', message: String(raw.message || 'Hello.') };
  }

  if (raw.kind === 'UNSUPPORTED') {
    return { kind: 'UNSUPPORTED', reason: String(raw.reason || 'Unsupported.') };
  }

  return raw;
}
