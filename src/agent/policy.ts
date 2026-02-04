import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { Intent } from '@/agent/intentSchema';

export type PolicyResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function enforcePolicy(connection: Connection, owner: string | undefined, intent: Intent): Promise<PolicyResult> {
  if (intent.kind === 'CHAT') return { ok: true };
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

  if (intent.kind === 'SWAP') {
    if (intent.from === intent.to) return { ok: false, reason: 'Swap assets must differ' };
    if (intent.amount.unit !== 'SOL') return { ok: false, reason: 'Only SOL amounts are supported in v1' };
    if (intent.from !== 'SOL') return { ok: false, reason: 'Only SOL → USDC swaps are supported in v1' };
  }

  if (intent.kind === 'EXIT_TO_USDC') {
    if (intent.amount.unit !== 'SOL') return { ok: false, reason: 'Only SOL amounts are supported in v1' };
  }

  const ownerKey = new PublicKey(owner);
  const lamports = await connection.getBalance(ownerKey);
  const solBalance = lamports / LAMPORTS_PER_SOL;

  const requestedSol = intent.amount.value;
  if (requestedSol > solBalance * 0.95) {
    return { ok: false, reason: `Requested ${requestedSol} SOL exceeds safe spend (95% of balance)` };
  }

  return { ok: true };
}
