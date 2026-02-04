
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import { AgentWallet } from './wallet';
import { KaminoManager } from './kamino';
import { RiskManager, RiskParameters } from './risk';

dotenv.config();

export interface AgentStatus {
  startTime: number;
  totalValueLocked: number;
  activePositions: any[];
  riskLevel: string;
  currentEpoch: number;
  solPrice: number | null;
  walletAddress: string;
  balance: number;
  riskAlerts: any[];
  portfolioMetrics?: any;
}

export class IBRLAgent {
  private connection: Connection;
  private apiKey: string;
  private startTime: number;
  private status: AgentStatus;
  private wallet: AgentWallet;
  private kamino: KaminoManager;
  private riskManager: RiskManager;

  constructor() {
    this.connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
    this.apiKey = process.env.HACKATHON_API_KEY || '';
    this.startTime = Date.now();
    this.wallet = new AgentWallet(this.connection);
    this.kamino = new KaminoManager(this.connection);
    
    // Initialize risk manager with default parameters
    const riskParameters: RiskParameters = {
      maxDrawdown: 0.15, // 15% max drawdown
      stopLossThreshold: 85, // Stop loss at $85 SOL
      maxPositionSize: 10, // Max 10 SOL position
      minHealthFactor: 1.2 // Minimum 1.2 health factor
    };
    
    this.riskManager = new RiskManager(this.connection, this.kamino, riskParameters);
    
    this.status = {
      startTime: this.startTime,
      totalValueLocked: 0,
      activePositions: [],
      riskLevel: 'INITIALIZING',
      currentEpoch: 0,
      solPrice: null,
      walletAddress: this.wallet.publicKey.toBase58(),
      balance: 0,
      riskAlerts: []
    };
  }

  async updateNetworkStats() {
    console.log('[IBRL] Updating network stats...');
    try {
      const epochInfo = await this.connection.getEpochInfo();
      this.status.currentEpoch = epochInfo.epoch;

      const balance = await this.wallet.getBalance();
      this.status.balance = balance / LAMPORTS_PER_SOL;

      // Primary: Jupiter Price API
      try {
        const priceResponse = await fetch('https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112');
        const priceData = await priceResponse.json();
        const price = priceData.data?.['So11111111111111111111111111111111111111112']?.price;
        if (price) {
          this.status.solPrice = parseFloat(price);
          console.log('[IBRL] SOL Price (Jupiter):', this.status.solPrice);
        }
      } catch (e) {
        console.warn('[IBRL] Jupiter Price API failed, trying CoinGecko...');
        const cgResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const cgData = await cgResponse.json();
        this.status.solPrice = cgData.solana.usd;
        console.log('[IBRL] SOL Price (CoinGecko):', this.status.solPrice);
      }

      if (!this.status.solPrice) {
         // Final Fallback: Hardcoded for demo if all APIs fail (only as absolute last resort)
         this.status.solPrice = 98.42; 
         console.warn('[IBRL] All price APIs failed, using last known fallback.');
      }

      // Update risk assessment and portfolio metrics
      if (this.status.solPrice) {
        const riskAssessment = await this.riskManager.assessRisk(
          this.wallet.publicKey.toBase58(),
          this.status.solPrice
        );
        
        this.status.riskAlerts = riskAssessment.alerts;
        this.status.portfolioMetrics = riskAssessment.metrics;
        this.status.activePositions = riskAssessment.metrics.positions;
        
        // Update risk level based on alerts
        if (riskAssessment.shouldStopTrading) {
          this.status.riskLevel = 'CRITICAL';
        } else if (riskAssessment.alerts.some(alert => alert.severity === 'HIGH')) {
          this.status.riskLevel = 'HIGH';
        } else if (riskAssessment.alerts.some(alert => alert.severity === 'MEDIUM')) {
          this.status.riskLevel = 'MEDIUM';
        } else {
          this.status.riskLevel = 'OPTIMAL';
        }
      }
      
    } catch (error) {
      console.error('[IBRL] Critical sync failure:', error);
      this.status.riskLevel = 'DEGRADED';
    }
  }

  getUptimeString(): string {
    const diff = Date.now() - this.startTime;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}H ${minutes}M`;
  }

  getStatus() {
    return {
      ...this.status,
      uptime: this.getUptimeString(),
      lastUpdate: new Date().toISOString()
    };
  }

  async runCycle() {
    await this.updateNetworkStats();
    console.log(`[IBRL] Cycle complete. SOL: ${this.status.solPrice} | Epoch: ${this.status.currentEpoch}`);
  }
}
