import { NextResponse } from 'next/server';
import { Connection } from '@solana/web3.js';
import { evaluateAutonomy } from '@/agent/autonomy';

export const runtime = 'nodejs';

const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

export async function GET(req: Request) {
  const url = new URL(req.url);
  const owner = url.searchParams.get('owner')?.trim();
  if (!owner) return NextResponse.json({ error: 'owner required' }, { status: 400 });

  try {
    await evaluateAutonomy(connection, { owner });
    return NextResponse.json({ ok: true, owner, ts: Date.now() });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, owner, error: message }, { status: 500 });
  }
}

