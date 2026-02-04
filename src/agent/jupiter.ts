
import { createJupiterApiClient, QuoteResponse } from '@jup-ag/api';
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';

export class JupiterManager {
  private jupiterApi = createJupiterApiClient();
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 50
  ): Promise<QuoteResponse | null> {
    try {
      const quote = await this.jupiterApi.quoteGet({
        inputMint,
        outputMint,
        amount,
        slippageBps,
      });
      return quote;
    } catch (error) {
      console.error('[Jupiter] Error fetching quote:', error);
      return null;
    }
  }

  async swap(quoteResponse: QuoteResponse, userPublicKey: string) {
    try {
      const { swapTransaction } = await this.jupiterApi.swapPost({
        swapRequest: {
          quoteResponse,
          userPublicKey,
          wrapAndUnwrapSol: true,
        },
      });

      const transaction = VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'));
      return { transaction, swapTransactionBase64: swapTransaction };
    } catch (error) {
      console.error('[Jupiter] Error creating swap transaction:', error);
      return null;
    }
  }
}
