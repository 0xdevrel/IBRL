import { JupiterManager } from './jupiter';
import { Connection, PublicKey } from '@solana/web3.js';

export type ActionType = 'ALLOCATE' | 'PROTECT' | 'HARVEST' | 'EXIT';

export interface StrategyStep {
  type: ActionType;
  description: string;
  params: any;
}

export class IntentEngine {
  private jupiter: JupiterManager;

  constructor(connection: Connection) {
    this.jupiter = new JupiterManager(connection);
  }

  /**
   * Parses human intent into a structured multi-step strategy.
   * "Chase 10% APY on SOL but exit if it drops 5%"
   */
  async parse(input: string): Promise<StrategyStep[]> {
    const steps: StrategyStep[] = [];
    const prompt = input.toLowerCase();

    // 1. Detection of Yield Intent
    if (prompt.includes('yield') || prompt.includes('apy') || prompt.includes('earn')) {
      steps.push({
        type: 'ALLOCATE',
        description: 'Optimizing for maximum stablecoin yield via Kamino/Drift',
        params: { target: 'USDC', minApy: 0.08 }
      });
    }

    // 2. Detection of Risk/Protection Intent
    if (prompt.includes('protect') || prompt.includes('stop loss') || prompt.includes('exit if')) {
      steps.push({
        type: 'PROTECT',
        description: 'Enabling dynamic stop-loss at 5% drawdown threshold',
        params: { threshold: 0.05, asset: 'SOL' }
      });
    }

    // 3. Detection of specific asset preference
    if (prompt.includes('sol') && !prompt.includes('usdc')) {
        steps.push({
            type: 'HARVEST',
            description: 'Compounding rewards back into JitoSOL',
            params: { asset: 'SOL' }
        });
    }

    return steps;
  }

  async generateExecutionPlan(steps: StrategyStep[]) {
    // In a production build, this would simulate the transactions via Solana's simulateTransaction
    console.log(`[Intent] Generating execution plan for ${steps.length} steps...`);
    return steps.map(s => ({
      ...s,
      status: 'READY',
      timestamp: Date.now()
    }));
  }
}