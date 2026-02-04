import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as any;
  const decision = String(body?.decision || '').toUpperCase();
  const signature = body?.signature ? String(body.signature) : null;

  if (!['DENIED', 'SENT'].includes(decision)) {
    return NextResponse.json({ error: 'decision must be DENIED or SENT' }, { status: 400 });
  }

  const db = getDb();
  const now = Date.now();
  const row = db
    .prepare(`SELECT id, status FROM proposals WHERE id = ?`)
    .get(id) as any | undefined;
  if (!row) return NextResponse.json({ error: 'proposal not found' }, { status: 404 });

  // Only allow decisions from pending state (idempotent).
  if (row.status !== 'PENDING_APPROVAL') {
    return NextResponse.json({ ok: true, id, status: row.status });
  }

  const newStatus = decision === 'SENT' ? 'SENT' : 'DENIED';
  db.prepare(`UPDATE proposals SET status = ?, signature = COALESCE(?, signature), updated_at = ? WHERE id = ?`).run(
    newStatus,
    signature,
    now,
    id
  );

  return NextResponse.json({ ok: true, id, status: newStatus, signature });
}

