import { NextResponse } from 'next/server';
import { getSolUsdPriceFromHermes } from '@/lib/pyth';

type PriceCache = {
  ts: number;
  solPrice: number | null;
  publishTime?: number;
  conf?: number;
};

let cache: PriceCache | null = null;

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.ts < 10_000) {
    return NextResponse.json({ ...cache, cached: true });
  }

  try {
    const { price, conf, publishTime } = await getSolUsdPriceFromHermes();
    cache = { ts: now, solPrice: price, conf, publishTime };
    return NextResponse.json({ ...cache, cached: false });
  } catch {
    // If the oracle is unavailable, return null (no fake fallbacks).
    cache = { ts: now, solPrice: null };
    return NextResponse.json({ ...cache, cached: false });
  }
}
