
import { Keypair, Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import * as dotenv from 'dotenv';

dotenv.config();

export class AgentWallet {
  private keypair: Keypair;
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
    const privateKeyRaw = process.env.AGENT_PRIVATE_KEY;
    if (!privateKeyRaw) {
      throw new Error('AGENT_PRIVATE_KEY not found in environment');
    }
    
    try {
      const secretKey = Uint8Array.from(JSON.parse(privateKeyRaw));
      this.keypair = Keypair.fromSecretKey(secretKey);
    } catch (e) {
      throw new Error('Invalid AGENT_PRIVATE_KEY format');
    }
  }

  get publicKey() {
    return this.keypair.publicKey;
  }

  async signAndSend(transaction: Transaction | VersionedTransaction) {
    if (transaction instanceof Transaction) {
      transaction.partialSign(this.keypair);
      const signature = await this.connection.sendRawTransaction(transaction.serialize());
      return signature;
    } else {
      transaction.sign([this.keypair]);
      const signature = await this.connection.sendRawTransaction(transaction.serialize());
      return signature;
    }
  }

  async getBalance() {
    return await this.connection.getBalance(this.publicKey);
  }
}
