import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { Intent } from '@/agent/intentSchema';

export type PolicyResult =
  | { ok: true }
  | { ok: false; reason: string };

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

function toBaseUnits(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return BigInt(Math.floor(value * factor + 1e-8));
}

async function getUsdcBalanceBaseUnits(connection: Connection, owner: PublicKey) {
  const ata = getAssociatedTokenAddressSync(USDC_MINT, owner, false);
  try {
    const bal = await connection.getTokenAccountBalance(ata);
    const amount = BigInt(bal.value.amount);
    const decimals = bal.value.decimals;
    return { amount, decimals };
  } catch {
    return { amount: BigInt(0), decimals: 6 };
  }
}

export async function enforcePolicy(connection: Connection, owner: string | undefined, intent: Intent): Promise<PolicyResult> {
  if (intent.kind === 'CHAT') return { ok: true };
  if (intent.kind === 'PORTFOLIO_QA') {
    if (!owner) return { ok: false, reason: 'Wallet not connected' };
    return { ok: true };
  }
  if (intent.kind === 'UNSUPPORTED') return { ok: false, reason: intent.reason };

  if (!owner) return { ok: false, reason: 'Wallet not connected' };

  if (intent.slippageBps > 100) {
    return { ok: false, reason: 'Slippage too high (max 100 bps)' };
  }

  if (intent.kind === 'PRICE_TRIGGER_EXIT') {
    if (intent.amount.unit !== 'SOL') return { ok: false, reason: 'Only SOL amounts are supported in v1' };
    if (intent.thresholdUsd < 1 || intent.thresholdUsd > 10_000) {
      return { ok: false, reason: 'Threshold out of bounds' };
    }
  }

  if (intent.kind === 'PRICE_TRIGGER_ENTRY') {
    if (intent.amount.unit !== 'USDC') return { ok: false, reason: 'Only USDC amounts are supported for entry in v1' };
    if (intent.thresholdUsd < 1 || intent.thresholdUsd > 10_000) {
      return { ok: false, reason: 'Threshold out of bounds' };
    }
  }

  if (intent.kind === 'DCA_SWAP') {
    if (intent.from === intent.to) return { ok: false, reason: 'Swap assets must differ' };
    if (!['SOL', 'USDC'].includes(intent.from) || !['SOL', 'USDC'].includes(intent.to)) {
      return { ok: false, reason: 'Only SOL and USDC are supported in v1' };
    }
    if (intent.amount.unit !== intent.from) return { ok: false, reason: 'Amount unit must match the from asset' };
    if (intent.intervalMinutes < 5) return { ok: false, reason: 'Interval too short (min 5 minutes)' };
  }

  if (intent.kind === 'SWAP') {
    if (intent.from === intent.to) return { ok: false, reason: 'Swap assets must differ' };
    if (!['SOL', 'USDC'].includes(intent.from) || !['SOL', 'USDC'].includes(intent.to)) {
      return { ok: false, reason: 'Only SOL and USDC are supported in v1' };
    }
    if (intent.amount.unit !== intent.from) return { ok: false, reason: 'Amount unit must match the from asset' };
  }

  if (intent.kind === 'EXIT_TO_USDC') {
    if (intent.amount.unit !== 'SOL') return { ok: false, reason: 'Only SOL amounts are supported in v1' };
  }

  const ownerKey = new PublicKey(owner);
  if (intent.amount.unit === 'SOL') {
    const lamports = await connection.getBalance(ownerKey);
    const solBalance = lamports / LAMPORTS_PER_SOL;
    const requestedSol = intent.amount.value;
    if (requestedSol > solBalance * 0.95) {
      return { ok: false, reason: `Requested ${requestedSol} SOL exceeds safe spend (95% of balance)` };
    }
  }

  if (intent.amount.unit === 'USDC') {
    const { amount: usdcBase, decimals } = await getUsdcBalanceBaseUnits(connection, ownerKey);
    const requested = toBaseUnits(intent.amount.value, decimals);
    if (requested > (usdcBase * BigInt(95)) / BigInt(100)) {
      return { ok: false, reason: `Requested ${intent.amount.value} USDC exceeds safe spend (95% of balance)` };
    }
  }

  return { ok: true };
}
