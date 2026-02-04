
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import { AgentWallet } from './wallet';
import { getSolUsdPriceFromHermes } from '../lib/pyth';
import { evaluateAutonomy } from './autonomy';

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
  private enableAutonomy: boolean;

  constructor(opts?: { enableAutonomy?: boolean }) {
    this.connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
    this.apiKey = process.env.HACKATHON_API_KEY || '';
    this.startTime = Date.now();
    this.wallet = new AgentWallet(this.connection);
    this.enableAutonomy = Boolean(opts?.enableAutonomy);
    
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

      try {
        const { price } = await getSolUsdPriceFromHermes();
        this.status.solPrice = price;
        console.log('[IBRL] SOL/USD (Pyth Hermes):', this.status.solPrice);
      } catch {
        this.status.solPrice = null;
        console.warn('[IBRL] SOL/USD oracle unavailable.');
      }
      // Risk engine + DeFi position monitoring will be wired once real protocol adapters are integrated.
      this.status.riskAlerts = [];
      this.status.activePositions = [];
      this.status.riskLevel = this.status.solPrice ? 'OPTIMAL' : 'DEGRADED';
      
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
    if (this.enableAutonomy) {
      await evaluateAutonomy(this.connection);
    }
    console.log(`[IBRL] Cycle complete. SOL: ${this.status.solPrice} | Epoch: ${this.status.currentEpoch}`);
  }
}
