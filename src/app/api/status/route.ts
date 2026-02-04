
import { NextResponse } from 'next/server';
import { IBRLAgent } from '@/agent/core';

// In a real app, we'd use a singleton or a global variable to persist the agent instance
// For this prototype, we'll initialize a static instance for the API to report
const agent = new IBRLAgent();

export async function GET() {
  await agent.updateNetworkStats();
  const status = agent.getStatus();
  
  return NextResponse.json(status);
}
