import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as any;
  const owner = String(body?.owner || '').trim();
  const action = String(body?.action || '').toUpperCase();

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (!owner) return NextResponse.json({ error: 'owner required' }, { status: 400 });
  if (!['PAUSE', 'RESUME'].includes(action)) {
    return NextResponse.json({ error: 'action must be PAUSE or RESUME' }, { status: 400 });
  }

  const db = getDb();
  const row = db.prepare(`SELECT id, status FROM intents WHERE id = ? AND owner = ?`).get(id, owner) as any | undefined;
  if (!row) return NextResponse.json({ error: 'intent not found' }, { status: 404 });

  const nextStatus = action === 'PAUSE' ? 'PAUSED' : 'ACTIVE';
  const now = Date.now();
  db.prepare(`UPDATE intents SET status = ?, updated_at = ? WHERE id = ? AND owner = ?`).run(nextStatus, now, id, owner);

  return NextResponse.json({ ok: true, id, status: nextStatus });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const owner = url.searchParams.get('owner')?.trim();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (!owner) return NextResponse.json({ error: 'owner required' }, { status: 400 });

  const db = getDb();
  const row = db.prepare(`SELECT id FROM intents WHERE id = ? AND owner = ?`).get(id, owner) as any | undefined;
  if (!row) return NextResponse.json({ error: 'intent not found' }, { status: 404 });

  // Keep proposals; removing the intent sets intent_id to NULL (FK is ON DELETE SET NULL).
  db.prepare(`DELETE FROM intents WHERE id = ? AND owner = ?`).run(id, owner);
  return NextResponse.json({ ok: true, id });
}

