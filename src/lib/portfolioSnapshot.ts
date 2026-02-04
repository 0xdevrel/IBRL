import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { getSolUsdPriceFromHermes } from '@/lib/pyth';

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

export type PortfolioSnapshot = {
  owner: string;
  solBalance: number;
  usdcBalance: number;
  solUsdPrice: number | null;
  epoch: number | null;
};

export async function getPortfolioSnapshot(connection: Connection, owner: string): Promise<PortfolioSnapshot> {
  const ownerKey = new PublicKey(owner);
  const lamports = await connection.getBalance(ownerKey);
  const solBalance = lamports / LAMPORTS_PER_SOL;

  const usdcAta = getAssociatedTokenAddressSync(USDC_MINT, ownerKey, false);
  let usdcBalance = 0;
  try {
    const bal = await connection.getTokenAccountBalance(usdcAta);
    const amount = Number(bal.value.amount);
    const decimals = bal.value.decimals;
    usdcBalance = decimals > 0 ? amount / 10 ** decimals : amount;
  } catch {
    usdcBalance = 0;
  }

  let solUsdPrice: number | null = null;
  try {
    const { price } = await getSolUsdPriceFromHermes();
    solUsdPrice = price;
  } catch {
    solUsdPrice = null;
  }

  let epoch: number | null = null;
  try {
    const info = await connection.getEpochInfo();
    epoch = info.epoch;
  } catch {
    epoch = null;
  }

  return { owner, solBalance, usdcBalance, solUsdPrice, epoch };
}
