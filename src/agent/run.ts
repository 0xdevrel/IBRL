
import { IBRLAgent } from './core';

async function main() {
  const agent = new IBRLAgent({ enableAutonomy: true });
  console.log('IBRL Agent starting up...');

  // Simple loop to simulate autonomous behavior
  // In a real environment, this would be a cron or a persistent process
  while (true) {
    try {
      await agent.runCycle();
    } catch (e) {
      console.error('Error in agent cycle:', e);
    }
    
    // Wait 30 seconds before next cycle (heartbeat is ~30 mins recommended, 
    // but we'll run logic more frequently)
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
}

main().catch(console.error);
