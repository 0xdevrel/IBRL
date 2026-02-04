'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletButton } from '@/components/WalletButton';
import { WalletContextProvider } from '@/components/WalletContextProvider';

function DashboardContent() {
  const { publicKey, connected, sendTransaction } = useWallet();
  const [data, setData] = useState<any>(null);
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    setTime(new Date().toLocaleTimeString());
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) throw new Error('Failed to fetch');
        const status = await res.json();
        setData(status);
      } catch (e) { 
        console.error('[Dashboard] Status Fetch Error:', e); 
      }
    };
    fetchStatus();
    const interval = setInterval(() => {
        fetchStatus();
        setTime(new Date().toLocaleTimeString());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt) return;
    setLoading(true);
    try {
      const res = await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const result = await res.json();
      setPlan(result.plan || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleProvision = async () => {
    if (!publicKey || !data?.walletAddress) return;
    setProvisioning(true);
    try {
      const { SystemProgram, Transaction, LAMPORTS_PER_SOL, PublicKey: SolanaPublicKey, Connection } = await import('@solana/web3.js');
      const connection = new Connection('https://api.mainnet-beta.solana.com');
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new SolanaPublicKey(data.walletAddress),
          lamports: 0.05 * LAMPORTS_PER_SOL,
        })
      );
      const signature = await sendTransaction(transaction, connection);
      alert(`Provisioning sent! Sig: ${signature.slice(0, 8)}`);
    } catch (e) {
      console.error('Provisioning failed', e);
      alert('Provisioning failed. Check console.');
    }
    setProvisioning(false);
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white pb-24">
      <nav className="fixed top-0 w-full h-20 bg-white border-b-4 border-black z-50 flex items-center justify-between px-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-black flex items-center justify-center">
             <div className="w-5 h-5 border-2 border-white rotate-45" />
          </div>
          <span className="text-2xl font-black tracking-tighter italic">IBRL_CORE</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="font-mono text-[10px] font-bold uppercase bg-[#9EFFBF] border-2 border-black px-4 py-1">
            {data?.riskLevel || 'SYNCING'}
          </div>
          <WalletButton />
        </div>
      </nav>

      <main className="pt-32 px-10 max-w-[1400px] mx-auto">
        <div className="mb-20">
          <h1 className="text-[14vw] font-black leading-[0.75] tracking-tighter uppercase mb-6">IBRL_VAULT</h1>
          <div className="border-t-4 border-black pt-6 flex flex-col md:flex-row justify-between gap-10">
             <p className="font-mono text-lg font-bold uppercase max-w-xl leading-tight text-black">
               Autonomous risk mitigation. <br/>
               Direct human-to-agent capital provisioning.
             </p>
             <div className="font-mono text-xs font-black uppercase space-y-2">
                <div className="flex justify-between w-64">
                   <span className="text-black/40">Status</span>
                   <span className="text-emerald-600">ONLINE</span>
                </div>
                <div className="flex justify-between w-64">
                   <span className="text-black/40">User</span>
                   <span className="text-black">{connected ? publicKey?.toBase58().slice(0,12) + '...' : 'AWAITING_AUTH'}</span>
                </div>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-black border-4 border-black mb-16">
           {[
             ['SOL / USD', `$${data?.solPrice?.toFixed(2) || '0.00'}`],
             ['Vault Balance', `${data?.balance?.toFixed(4) || '0.0000'} SOL`],
             ['Solana Epoch', data?.currentEpoch || '---'],
             ['Uptime', data?.uptime || '0H 0M']
           ].map(([label, val]) => (
             <div key={label} className="bg-white p-10">
               <span className="font-mono text-[10px] uppercase font-black text-black/40 tracking-[0.2em]">{label}</span>
               <h3 className="text-5xl font-black mt-2 text-black">{val}</h3>
             </div>
           ))}
        </div>

        <div className="bg-black text-white p-8 mb-16 flex flex-col md:flex-row justify-between items-center gap-6 border-4 border-black">
           <div className="font-mono font-bold">
              <span className="text-[#9EFFBF]">AGENT_PROXY:</span> {data?.walletAddress || 'INITIALIZING...'}
           </div>
           <button 
             onClick={handleProvision}
             disabled={!connected || provisioning}
             className="bg-[#9EFFBF] text-black px-10 py-4 font-black uppercase text-sm hover:opacity-90 disabled:opacity-20 transition-all"
           >
             {provisioning ? 'PROCESSING...' : 'PROVISION_0.05_SOL'}
           </button>
        </div>

        <div className="border-4 border-black p-10 bg-white mb-16 relative">
           <div className="absolute top-0 right-0 w-4 h-4 bg-black" />
           <div className="absolute bottom-0 left-0 w-4 h-4 bg-black" />
           
           <h2 className="font-mono text-xs font-black uppercase mb-10 tracking-[0.3em] flex items-center gap-2 text-black">
             <div className="w-2 h-2 bg-black animate-pulse" />
             Command_Protocol_Alpha
           </h2>

           <form onSubmit={handleCommand} className="flex flex-col gap-6">
              <input 
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="ENTER STRATEGIC INTENT"
                className="w-full bg-[#F5F5F5] border-2 border-black p-8 font-mono text-2xl font-black text-black placeholder:text-black/40 focus:outline-none focus:bg-white"
              />
              <button className="bg-black text-white p-8 font-mono text-xl font-black uppercase tracking-[0.4em] hover:bg-emerald-900 transition-all">
                Execute_Strategy
              </button>
           </form>

           {plan.length > 0 && (
             <div className="mt-10 pt-10 border-t-2 border-black space-y-4">
                {plan.map((step, i) => (
                  <div key={i} className="flex gap-6 border-2 border-black p-6 bg-[#F5F5F5]">
                     <span className="font-black text-2xl text-black">0{i+1}</span>
                     <div>
                        <div className="font-black uppercase text-sm text-black">{step.type}</div>
                        <div className="font-mono text-xs text-black/60">{step.description}</div>
                     </div>
                  </div>
                ))}
             </div>
           )}
        </div>

        <div className="bg-black text-[#9EFFBF] p-10 font-mono text-xs">
           <div className="flex justify-between border-b border-[#9EFFBF]/20 pb-4 mb-4">
              <span className="font-black uppercase">Telemetry_Stream</span>
              <span className="opacity-50">NODE_STATUS: OPTIMAL</span>
           </div>
           <div className="space-y-2 opacity-80">
              <div>[{time}] CORE_SYSTEM_NOMINAL</div>
              <div>[{time}] PRICE_FEED_SYNCED: ${data?.solPrice}</div>
              <div className="animate-pulse">[{time}] AWAITING_AUTHORIZATION...</div>
           </div>
        </div>
      </main>
    </div>
  );
}

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <div className="min-h-screen bg-white" />;
  
  return (
    <WalletContextProvider>
      <DashboardContent />
    </WalletContextProvider>
  );
}