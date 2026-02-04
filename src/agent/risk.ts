import { Connection, PublicKey } from '@solana/web3.js';
import { KaminoManager } from './kamino';

export interface RiskParameters {
  maxDrawdown: number; // Maximum allowed drawdown (0.1 = 10%)
  stopLossThreshold: number; // Price threshold for stop-loss
  maxPositionSize: number; // Maximum position size in SOL
  minHealthFactor: number; // Minimum health factor for Kamino positions
}

export interface RiskAlert {
  type: 'DRAWDOWN' | 'STOP_LOSS' | 'POSITION_SIZE' | 'HEALTH_FACTOR';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  currentValue: number;
  threshold: number;
  timestamp: number;
}

export interface PortfolioMetrics {
  totalValue: number;
  initialBalance: number;
  currentValue: number;
  unrealizedPnL: number;
  realizedPnL: number;
  drawdown: number;
  maxDrawdown: number;
  positions: any[];
}

export class RiskManager {
  private connection: Connection;
  private kamino: KaminoManager;
  private parameters: RiskParameters;
  private initialBalance: number = 0;
  private maxPortfolioValue: number = 0;
  private realizedPnL: number = 0;

  constructor(connection: Connection, kamino: KaminoManager, parameters: RiskParameters) {
    this.connection = connection;
    this.kamino = kamino;
    this.parameters = parameters;
  }

  setInitialBalance(balance: number) {
    this.initialBalance = balance;
    this.maxPortfolioValue = balance;
  }

  async assessRisk(walletAddress: string, currentPrice: number): Promise<{
    alerts: RiskAlert[];
    metrics: PortfolioMetrics;
    shouldStopTrading: boolean;
  }> {
    const alerts: RiskAlert[] = [];
    const positions = await this.kamino.getCurrentPositions(walletAddress);
    
    // Calculate current portfolio value
    const positionValue = positions.reduce((sum, pos) => sum + pos.collateralValue, 0);
    const currentValue = positionValue; // Simplified - would include wallet balance
    
    // Update max portfolio value for drawdown calculation
    if (currentValue > this.maxPortfolioValue) {
      this.maxPortfolioValue = currentValue;
    }

    // Calculate metrics
    const unrealizedPnL = currentValue - this.initialBalance;
    const drawdown = this.maxPortfolioValue > 0 ? (this.maxPortfolioValue - currentValue) / this.maxPortfolioValue : 0;
    const maxDrawdown = this.maxPortfolioValue > 0 ? (this.maxPortfolioValue - this.initialBalance) / this.maxPortfolioValue : 0;

    const metrics: PortfolioMetrics = {
      totalValue: currentValue,
      initialBalance: this.initialBalance,
      currentValue,
      unrealizedPnL,
      realizedPnL: this.realizedPnL,
      drawdown,
      maxDrawdown,
      positions
    };

    let shouldStopTrading = false;

    // Check 1: Maximum drawdown
    if (drawdown > this.parameters.maxDrawdown) {
      alerts.push({
        type: 'DRAWDOWN',
        severity: drawdown > this.parameters.maxDrawdown * 1.5 ? 'CRITICAL' : 'HIGH',
        message: `Maximum drawdown exceeded: ${(drawdown * 100).toFixed(2)}%`,
        currentValue: drawdown,
        threshold: this.parameters.maxDrawdown,
        timestamp: Date.now()
      });
      shouldStopTrading = true;
    }

    // Check 2: Stop-loss threshold
    if (currentPrice < this.parameters.stopLossThreshold) {
      alerts.push({
        type: 'STOP_LOSS',
        severity: 'HIGH',
        message: `Stop-loss triggered: SOL price $${currentPrice.toFixed(2)} below $${this.parameters.stopLossThreshold}`,
        currentValue: currentPrice,
        threshold: this.parameters.stopLossThreshold,
        timestamp: Date.now()
      });
      shouldStopTrading = true;
    }

    // Check 3: Position size
    if (positionValue > this.parameters.maxPositionSize) {
      alerts.push({
        type: 'POSITION_SIZE',
        severity: 'MEDIUM',
        message: `Position size exceeded: ${positionValue.toFixed(2)} SOL > ${this.parameters.maxPositionSize} SOL`,
        currentValue: positionValue,
        threshold: this.parameters.maxPositionSize,
        timestamp: Date.now()
      });
    }

    // Check 4: Kamino health factor
    for (const position of positions) {
      if (position.healthFactor < this.parameters.minHealthFactor) {
        alerts.push({
          type: 'HEALTH_FACTOR',
          severity: position.healthFactor < 1.1 ? 'CRITICAL' : 'HIGH',
          message: `Low health factor for ${position.mint}: ${position.healthFactor.toFixed(2)}`,
          currentValue: position.healthFactor,
          threshold: this.parameters.minHealthFactor,
          timestamp: Date.now()
        });
        
        if (position.healthFactor < 1.1) {
          shouldStopTrading = true;
        }
      }
    }

    // Add medium risk alerts for moderate drawdowns
    if (drawdown > this.parameters.maxDrawdown * 0.5 && drawdown <= this.parameters.maxDrawdown) {
      alerts.push({
        type: 'DRAWDOWN',
        severity: 'MEDIUM',
        message: `Moderate drawdown: ${(drawdown * 100).toFixed(2)}%`,
        currentValue: drawdown,
        threshold: this.parameters.maxDrawdown,
        timestamp: Date.now()
      });
    }

    return { alerts, metrics, shouldStopTrading };
  }

  async getEmergencyExitPlan(walletAddress: string): Promise<{
    steps: string[];
    estimatedTime: number;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }> {
    const positions = await this.kamino.getCurrentPositions(walletAddress);
    const steps: string[] = [];
    
    if (positions.length > 0) {
      steps.push('Close all Kamino positions');
      steps.push('Withdraw all collateral to wallet');
      steps.push('Convert all assets to USDC (stable)');
      steps.push('Verify final wallet balance');
    } else {
      steps.push('No active positions to close');
    }

    return {
      steps,
      estimatedTime: positions.length * 30 + 60, // 30s per position + 60s buffer
      priority: positions.length > 0 ? 'HIGH' : 'LOW'
    };
  }

  updateParameters(newParameters: Partial<RiskParameters>) {
    this.parameters = { ...this.parameters, ...newParameters };
    console.log('[Risk] Updated risk parameters:', this.parameters);
  }

  getParameters(): RiskParameters {
    return { ...this.parameters };
  }

  addRealizedPnL(amount: number) {
    this.realizedPnL += amount;
    console.log(`[Risk] Added realized P&L: ${amount} USDC, Total: ${this.realizedPnL} USDC`);
  }
}
