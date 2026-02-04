import { NextResponse } from 'next/server';

type PriceCache = {
  ts: number;
  solPrice: number | null;
};

let cache: PriceCache | null = null;

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.ts < 15_000) {
    return NextResponse.json({ ...cache, cached: true });
  }

  let solPrice: number | null = null;

  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { cache: 'no-store' }
    );
    if (res.ok) {
      const data: unknown = await res.json();
      const price = (data as any)?.solana?.usd;
      if (typeof price === 'number' && Number.isFinite(price)) {
        solPrice = price;
      }
    }
  } catch {
    // ignore
  }

  cache = { ts: now, solPrice };
  return NextResponse.json({ ...cache, cached: false });
}
