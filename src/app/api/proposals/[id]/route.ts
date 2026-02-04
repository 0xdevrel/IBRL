import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const owner = url.searchParams.get('owner')?.trim();

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (!owner) return NextResponse.json({ error: 'owner required' }, { status: 400 });

  const db = getDb();
  const r = db
    .prepare(
      `SELECT id, intent_id, kind, summary, quote_json, tx_base64, simulation_json, decision_report_json, created_by, status, signature, created_at, updated_at
       FROM proposals
       WHERE id = ? AND owner = ?`
    )
    .get(id, owner) as any | undefined;

  if (!r) return NextResponse.json({ error: 'proposal not found' }, { status: 404 });

  return NextResponse.json({
    id: r.id,
    intentId: r.intent_id,
    kind: r.kind,
    summary: r.summary,
    quote: r.quote_json ? JSON.parse(r.quote_json) : null,
    txBase64: r.tx_base64,
    simulation: r.simulation_json ? JSON.parse(r.simulation_json) : null,
    decisionReport: r.decision_report_json ? JSON.parse(r.decision_report_json) : null,
    createdBy: r.created_by,
    status: r.status,
    signature: r.signature,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
}

