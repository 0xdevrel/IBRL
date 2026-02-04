import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import { AgentWallet } from './wallet';

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
}

export class IBRLAgent {
  private connection: Connection;
  private apiKey: string;
  private startTime: number;
  private status: AgentStatus;
  private wallet: AgentWallet;

  constructor() {
    this.connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
    this.apiKey = process.env.HACKATHON_API_KEY || '';
    this.startTime = Date.now();
    this.wallet = new AgentWallet(this.connection);
    
    this.status = {
      startTime: this.startTime,
      totalValueLocked: 0,
      activePositions: [],
      riskLevel: 'CALCULATING',
      currentEpoch: 0,
      solPrice: null,
      walletAddress: this.wallet.publicKey.toBase58(),
      balance: 0,
    };
  }

  async updateNetworkStats() {
    try {
      const epochInfo = await this.connection.getEpochInfo();
      this.status.currentEpoch = epochInfo.epoch;

      const balance = await this.wallet.getBalance();
      this.status.balance = balance / LAMPORTS_PER_SOL;

      // Using Jupiter V6 Price API for better reliability
      const priceResponse = await fetch('https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112');
      const priceData = await priceResponse.json();
      const price = priceData.data?.['So11111111111111111111111111111111111111112']?.price;
      
      this.status.solPrice = price ? parseFloat(price) : null;
      this.status.riskLevel = this.status.solPrice ? 'OPTIMAL' : 'MONITORING';
    } catch (error) {
      console.error('[IBRL] Failed to update network stats:', error);
      this.status.riskLevel = 'DEGRADED';
    }
  }

  async heartbeat() {
    try {
      const response = await fetch('https://agents.colosseum.com/api/agents/status', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      return await response.json();
    } catch (error) {
      console.error('[IBRL] Heartbeat failed:', error);
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
    await this.heartbeat();
    console.log(`[IBRL] Cycle complete. Uptime: ${this.getUptimeString()} | Epoch: ${this.status.currentEpoch}`);
  }
}