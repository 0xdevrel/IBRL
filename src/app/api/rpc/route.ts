import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function getUpstreamRpcUrls(): string[] {
  const raw =
    process.env.SOLANA_RPC_URLS?.trim() ||
    process.env.SOLANA_RPC_URL?.trim() ||
    'https://api.mainnet-beta.solana.com';

  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function forwardOnce(upstream: string, bodyText: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const upstreamRes = await fetch(upstream, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: bodyText,
      cache: 'no-store',
      signal: controller.signal,
    });
    const text = await upstreamRes.text();
    return { upstreamRes, text };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: Request) {
  const upstreams = getUpstreamRpcUrls();

  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    let lastStatus = 502;
    let lastText = '';

    for (const upstream of upstreams) {
      const { upstreamRes, text } = await forwardOnce(upstream, bodyText);
      lastStatus = upstreamRes.status;
      lastText = text;

      // Some vendors return 403/429 based on rate limits or policy. Try the next one.
      if (upstreamRes.ok) {
        return new NextResponse(text, {
          status: upstreamRes.status,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (upstreamRes.status === 403 || upstreamRes.status === 429 || upstreamRes.status >= 500) {
        continue;
      }

      // For 4xx errors other than policy/rate limiting, return immediately (request likely invalid).
      return new NextResponse(text, {
        status: upstreamRes.status,
        headers: { 'content-type': 'application/json' },
      });
    }

    return new NextResponse(lastText || JSON.stringify({ error: 'Upstream RPC unavailable' }), {
      status: lastStatus || 502,
      headers: { 'content-type': 'application/json' },
    });
  } catch {
    return NextResponse.json({ error: 'Upstream RPC unavailable' }, { status: 502 });
  }
}
