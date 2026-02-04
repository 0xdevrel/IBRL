import { JupiterManager } from './jupiter';
import { KaminoManager } from './kamino';
import { AgentWallet } from './wallet';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';

export type ActionType = 'ALLOCATE' | 'PROTECT' | 'HARVEST' | 'EXIT';

export interface StrategyStep {
  type: ActionType;
  description: string;
  params: any;
}

export interface ExecutionResult {
  success: boolean;
  signature?: string;
  error?: string;
  details: any;
}

export class IntentEngine {
  private jupiter: JupiterManager;
  private kamino: KaminoManager;
  private wallet: AgentWallet;
  private connection: Connection;

  constructor(connection: Connection, wallet: AgentWallet) {
    this.jupiter = new JupiterManager(connection);
    this.kamino = new KaminoManager(connection);
    this.wallet = wallet;
    this.connection = connection;
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
    console.log(`[Intent] Generating execution plan for ${steps.length} steps...`);
    return steps.map(s => ({
      ...s,
      status: 'READY',
      timestamp: Date.now()
    }));
  }

  async executeStep(step: StrategyStep): Promise<ExecutionResult> {
    console.log(`[Intent] Executing step: ${step.type} - ${step.description}`);
    
    try {
      switch (step.type) {
        case 'ALLOCATE':
          return await this.executeAllocate(step);
        case 'PROTECT':
          return await this.executeProtect(step);
        case 'HARVEST':
          return await this.executeHarvest(step);
        case 'EXIT':
          return await this.executeExit(step);
        default:
          return {
            success: false,
            error: `Unknown action type: ${step.type}`,
            details: step
          };
      }
    } catch (error) {
      console.error(`[Intent] Error executing step ${step.type}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: step
      };
    }
  }

  private async executeAllocate(step: StrategyStep): Promise<ExecutionResult> {
    const { target, minApy } = step.params;
    
    if (target === 'USDC') {
      // Use Kamino for stablecoin yield
      const strategy = await this.kamino.optimizeYield(
        this.wallet.publicKey.toBase58(),
        minApy
      );
      
      if (strategy) {
        const transaction = await this.kamino.createDepositTransaction(
          this.wallet.publicKey.toBase58(),
          strategy.depositMint,
          100 // Mock amount
        );
        
        if (transaction) {
          const signature = await this.wallet.signAndSend(transaction);
          return {
            success: true,
            signature,
            details: { strategy, transaction: 'deposit' }
          };
        }
      }
    } else if (target === 'SOL') {
      // Use Jupiter to swap to USDC, then deposit to Kamino
      const quote = await this.jupiter.getQuote(
        'So11111111111111111111111111111111111111112', // SOL
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        100_000_000, // 0.1 SOL
        50 // 0.5% slippage
      );
      
      if (quote) {
        const transaction = await this.jupiter.swap(quote, this.wallet.publicKey.toBase58());
        if (transaction) {
          const signature = await this.wallet.signAndSend(transaction);
          return {
            success: true,
            signature,
            details: { quote, transaction: 'jupiter-swap' }
          };
        }
      }
    }
    
    return {
      success: false,
      error: 'Failed to execute allocation strategy',
      details: step
    };
  }

  private async executeProtect(step: StrategyStep): Promise<ExecutionResult> {
    const { threshold, asset } = step.params;
    
    // Get current price (simplified - would use price feed)
    const currentPrice = 100; // Mock SOL price
    
    // If price is below threshold, execute stop-loss
    if (currentPrice < threshold) {
      const quote = await this.jupiter.getQuote(
        asset === 'SOL' ? 'So11111111111111111111111111111111111111112' : 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Convert to USDC
        100_000_000,
        100 // Higher slippage for emergency exit
      );
      
      if (quote) {
        const transaction = await this.jupiter.swap(quote, this.wallet.publicKey.toBase58());
        if (transaction) {
          const signature = await this.wallet.signAndSend(transaction);
          return {
            success: true,
            signature,
            details: { stopLossTriggered: true, price: currentPrice, threshold }
          };
        }
      }
    }
    
    return {
      success: true,
      details: { stopLossTriggered: false, price: currentPrice, threshold }
    };
  }

  private async executeHarvest(step: StrategyStep): Promise<ExecutionResult> {
    const { asset } = step.params;
    
    // Withdraw from Kamino and compound
    const transaction = await this.kamino.createWithdrawTransaction(
      this.wallet.publicKey.toBase58(),
      asset === 'SOL' ? 'So11111111111111111111111111111111111111112' : 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      50 // Mock amount
    );
    
    if (transaction) {
      const signature = await this.wallet.signAndSend(transaction);
      return {
        success: true,
        signature,
        details: { harvesting: true, asset }
      };
    }
    
    return {
      success: false,
      error: 'Failed to harvest rewards',
      details: step
    };
  }

  private async executeExit(step: StrategyStep): Promise<ExecutionResult> {
    // Close all positions and return to base state
    const positions = await this.kamino.getCurrentPositions(this.wallet.publicKey.toBase58());
    const results = [];
    
    for (const position of positions) {
      const transaction = await this.kamino.createWithdrawTransaction(
        this.wallet.publicKey.toBase58(),
        position.mint,
        position.amount
      );
      
      if (transaction) {
        const signature = await this.wallet.signAndSend(transaction);
        results.push({ signature, position });
      }
    }
    
    return {
      success: results.length > 0,
      signature: results[0]?.signature,
      details: { exitedPositions: results.length, totalPositions: positions.length }
    };
  }

  async executeStrategy(steps: StrategyStep[]): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    
    for (const step of steps) {
      const result = await this.executeStep(step);
      results.push(result);
      
      // If a step fails, stop execution (unless it's a protective step)
      if (!result.success && step.type !== 'PROTECT') {
        console.log(`[Intent] Stopping execution due to failed step: ${step.type}`);
        break;
      }
      
      // Add delay between steps
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return results;
  }
}