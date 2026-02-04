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
      `SELECT id, prompt, execute, ok, payload_json, created_at
       FROM interactions
       WHERE owner = ?
       ORDER BY created_at ASC
       LIMIT 50`
    )
    .all(owner) as any[];

  return NextResponse.json({
    owner,
    interactions: rows.map((r) => ({
      id: r.id,
      prompt: r.prompt,
      execute: Boolean(r.execute),
      ok: Boolean(r.ok),
      payload: JSON.parse(r.payload_json),
      createdAt: r.created_at,
    })),
  });
}

