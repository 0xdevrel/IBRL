
import { NextResponse } from 'next/server';
import { Connection } from '@solana/web3.js';
import { IntentEngine } from '@/agent/strategy';

const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
const engine = new IntentEngine(connection);

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    if (!prompt) return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });

    const steps = await engine.parse(prompt);
    const plan = await engine.generateExecutionPlan(steps);

    return NextResponse.json({ 
      prompt,
      plan,
      timestamp: Date.now(),
      agentFingerprint: 'IBRL-α-01'
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to parse intent' }, { status: 500 });
  }
}
