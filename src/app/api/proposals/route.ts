import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const owner = url.searchParams.get('owner')?.trim();
  if (!owner) return NextResponse.json({ error: 'owner required' }, { status: 400 });

  const status = url.searchParams.get('status')?.trim() || '';
  const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);
  const offset = Math.max(Number(url.searchParams.get('offset') || 0), 0);

  const allowedStatuses = new Set(['PENDING_APPROVAL', 'SENT', 'DENIED']);
  const filterStatus = allowedStatuses.has(status) ? status : null;

  const db = getDb();
  const rows = (filterStatus
    ? db
        .prepare(
          `SELECT id, intent_id, kind, summary, quote_json, tx_base64, simulation_json, decision_report_json, created_by, status, signature, created_at, updated_at
           FROM proposals
           WHERE owner = ? AND status = ?
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`
        )
        .all(owner, filterStatus, limit, offset)
    : db
        .prepare(
          `SELECT id, intent_id, kind, summary, quote_json, tx_base64, simulation_json, decision_report_json, created_by, status, signature, created_at, updated_at
           FROM proposals
           WHERE owner = ?
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`
        )
        .all(owner, limit, offset)) as any[];

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
      decisionReport: r.decision_report_json ? JSON.parse(r.decision_report_json) : null,
      createdBy: r.created_by,
      status: r.status,
      signature: r.signature,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  });
}

