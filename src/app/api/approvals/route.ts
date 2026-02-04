import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const owner = url.searchParams.get('owner')?.trim();
  if (!owner) return NextResponse.json({ error: 'owner required' }, { status: 400 });

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, intent_id, kind, summary, quote_json, tx_base64, simulation_json, status, signature, created_at, updated_at
       FROM proposals
       WHERE owner = ? AND status = 'PENDING_APPROVAL'
       ORDER BY created_at DESC
       LIMIT 20`
    )
    .all(owner) as any[];

  return NextResponse.json({
    owner,
    proposals: rows.map((r) => ({
      id: r.id,
      intentId: r.intent_id,
      kind: r.kind,
      summary: r.summary,
      quote: r.quote_json ? JSON.parse(r.quote_json) : null,
      txBase64: r.tx_base64,
      simulation: r.simulation_json ? JSON.parse(r.simulation_json) : null,
      status: r.status,
      signature: r.signature,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  });
}

