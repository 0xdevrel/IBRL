
import { NextResponse } from 'next/server';
import { Connection } from '@solana/web3.js';
import { IntentEngine } from '@/agent/strategy';
import { AgentWallet } from '@/agent/wallet';

const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
const wallet = new AgentWallet(connection);
const engine = new IntentEngine(connection, wallet);

export async function POST(req: Request) {
  try {
    const { prompt, execute = false } = await req.json();
    if (!prompt) return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });

    const steps = await engine.parse(prompt);
    const plan = await engine.generateExecutionPlan(steps);

    let executionResults = null;
    if (execute) {
      executionResults = await engine.executeStrategy(steps);
    }

    return NextResponse.json({ 
      prompt,
      plan,
      executionResults,
      timestamp: Date.now(),
      agentFingerprint: 'IBRL-α-01'
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to parse intent' }, { status: 500 });
  }
}
