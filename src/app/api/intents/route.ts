import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { Connection } from '@solana/web3.js';
import { getDb } from '@/lib/db';
import { extractIntentWithGemini } from '@/lib/gemini';
import { enforcePolicy } from '@/agent/policy';

export const runtime = 'nodejs';

const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

export async function GET(req: Request) {
  const url = new URL(req.url);
  const owner = url.searchParams.get('owner')?.trim();
  if (!owner) return NextResponse.json({ error: 'owner required' }, { status: 400 });

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, kind, config_json, status, created_at, updated_at, last_fired_at
       FROM intents
       WHERE owner = ?
       ORDER BY created_at DESC
       LIMIT 50`
    )
    .all(owner) as any[];

  return NextResponse.json({
    owner,
    intents: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      config: JSON.parse(r.config_json),
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      lastFiredAt: r.last_fired_at,
    })),
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as any;
  const owner = String(body?.owner || '').trim();
  const prompt = String(body?.prompt || '').trim();
  if (!owner) return NextResponse.json({ error: 'owner required' }, { status: 400 });
  if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 });

  const intent = await extractIntentWithGemini(prompt);
  if (!['PRICE_TRIGGER_EXIT', 'PRICE_TRIGGER_ENTRY', 'DCA_SWAP'].includes(intent.kind)) {
    return NextResponse.json(
      { error: 'Only automations can be saved (PRICE_TRIGGER_EXIT, PRICE_TRIGGER_ENTRY, DCA_SWAP)', intent },
      { status: 400 }
    );
  }

  const policy = await enforcePolicy(connection, owner, intent);
  if (!policy.ok) {
    return NextResponse.json({ error: policy.reason, intent }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  const db = getDb();
  db.prepare(
    `INSERT INTO intents (id, owner, kind, config_json, status, created_at, updated_at, last_fired_at)
     VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, NULL)`
  ).run(id, owner, intent.kind, JSON.stringify(intent), now, now);

  return NextResponse.json({ ok: true, id, owner, intent });
}
