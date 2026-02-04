import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const owner = url.searchParams.get('owner')?.trim();
  if (!owner) return NextResponse.json({ error: 'owner required' }, { status: 400 });

  const db = getDb();

  const proposals = (db
    .prepare(
      `SELECT id, intent_id, kind, summary, status, signature, created_by, decision_report_json, created_at, updated_at
       FROM proposals
       WHERE owner = ?
       ORDER BY created_at DESC
       LIMIT 50`
    )
    .all(owner) as any[]).map((r) => ({
    id: r.id,
    intentId: r.intent_id,
    kind: r.kind,
    summary: r.summary,
    status: r.status,
    signature: r.signature,
    createdBy: r.created_by,
    decisionReport: r.decision_report_json ? JSON.parse(r.decision_report_json) : null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  const interactions = (db
    .prepare(
      `SELECT id, prompt, execute, ok, payload_json, created_at
       FROM interactions
       WHERE owner = ?
       ORDER BY created_at DESC
       LIMIT 50`
    )
    .all(owner) as any[]).map((r) => ({
    id: r.id,
    prompt: r.prompt,
    execute: Boolean(r.execute),
    ok: Boolean(r.ok),
    payload: JSON.parse(r.payload_json),
    createdAt: r.created_at,
  }));

  const intents = db
    .prepare(
      `SELECT id, kind, status, last_fired_at, created_at, updated_at
       FROM intents
       WHERE owner = ?
       ORDER BY created_at DESC
       LIMIT 50`
    )
    .all(owner) as any[];

  const samplesSince = Date.now() - 6 * 60 * 60_000;
  const priceSamples = (db
    .prepare(
      `SELECT source, price, ts
       FROM price_samples
       WHERE ts >= ?
       ORDER BY ts DESC
       LIMIT 200`
    )
    .all(samplesSince) as any[]).map((r) => ({
    source: r.source,
    price: r.price,
    ts: r.ts,
  }));

  const lastProposal = proposals[0]?.createdAt ?? null;
  const lastInteraction = interactions[0]?.createdAt ?? null;
  const lastPriceSample = priceSamples[0]?.ts ?? null;

  return NextResponse.json({
    owner,
    summary: {
      activeAutomations: intents.filter((i) => i.status === 'ACTIVE').length,
      totalAutomations: intents.length,
      pendingApprovals: proposals.filter((p) => p.status === 'PENDING_APPROVAL').length,
      lastProposalAt: lastProposal,
      lastInteractionAt: lastInteraction,
      lastPriceSampleAt: lastPriceSample,
    },
    proposals,
    interactions,
    intents: intents.map((i) => ({
      id: i.id,
      kind: i.kind,
      status: i.status,
      lastFiredAt: i.last_fired_at,
      createdAt: i.created_at,
      updatedAt: i.updated_at,
    })),
    priceSamples,
  });
}

