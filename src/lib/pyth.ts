export type PythPrice = {
  price: number;
  conf: number;
  publishTime: number;
};

const SOL_USD_FEED_ID =
  process.env.PYTH_SOL_USD_FEED_ID ||
  'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d';

export async function getSolUsdPriceFromHermes(): Promise<PythPrice> {
  const url = new URL('https://hermes.pyth.network/v2/updates/price/latest');
  url.searchParams.append('encoding', 'base64');
  url.searchParams.append('ids[]', SOL_USD_FEED_ID);

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Pyth Hermes error: HTTP ${res.status}`);
  }

  const json = (await res.json()) as any;
  const parsed = json?.parsed?.[0]?.price;
  if (!parsed) {
    throw new Error('Pyth Hermes error: missing parsed price');
  }

  const price = Number(parsed.price) * Math.pow(10, Number(parsed.expo));
  const conf = Number(parsed.conf) * Math.pow(10, Number(parsed.expo));
  const publishTime = Number(parsed.publish_time);

  if (!Number.isFinite(price)) {
    throw new Error('Pyth Hermes error: invalid price');
  }

  return { price, conf, publishTime };
}

