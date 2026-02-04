
import { NextResponse } from 'next/server';
import { IBRLAgent } from '@/agent/core';
import { getDb, getOrInitMeta } from '@/lib/db';

// In a real app, we'd use a singleton or a global variable to persist the agent instance
// For this prototype, we'll initialize a static instance for the API to report
const agent = new IBRLAgent({ enableAutonomy: false });

export async function GET() {
  await agent.updateNetworkStats();
  const status = agent.getStatus() as any;

  // Persisted "system uptime" across page refresh and server restarts (backed by SQLite).
  const db = getDb();
  const persistedStart = Number(getOrInitMeta(db, 'system_start_time', String(Date.now())));
  const diff = Date.now() - persistedStart;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  const uptime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  status.startTime = persistedStart;
  status.uptime = uptime;

  return NextResponse.json(status);
}
