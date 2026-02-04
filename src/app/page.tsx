
'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const StatusBadge = ({ label, active }: { label: string, active: boolean }) => (
  <div className={`inline-flex items-center gap-2 px-3 py-1 border border-black ${active ? 'bg-[#9EFFBF]' : 'bg-white'}`}>
    <div className={`w-2 h-2 ${active ? 'bg-black' : 'bg-black/20'} rounded-none`} />
    <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-black">{label}</span>
  </div>
);

const CornerMarkers = () => (
  <>
    <div className="absolute -top-px -left-px w-3 h-3 border-t-2 border-l-2 border-black" />
    <div className="absolute -top-px -right-px w-3 h-3 border-t-2 border-r-2 border-black" />
    <div className="absolute -bottom-px -left-px w-3 h-3 border-b-2 border-l-2 border-black" />
    <div className="absolute -bottom-px -right-px w-3 h-3 border-b-2 border-r-2 border-black" />
  </>
);

export default function Dashboard() {
  const { publicKey, connected, sendTransaction } = useWallet();
  const [data, setData] = useState<any>(null);
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);

  const handleProvision = async () => {
    if (!publicKey || !data?.walletAddress) return;
    setProvisioning(true);
    try {
      const { SystemProgram, Transaction, LAMPORTS_PER_SOL, PublicKey: SolanaPublicKey } = await import('@solana/web3.js');
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new SolanaPublicKey(data.walletAddress),
          lamports: 0.05 * LAMPORTS_PER_SOL,
        })
      );
      const signature = await sendTransaction(transaction, new (await import('@solana/web3.js')).Connection('https://api.mainnet-beta.solana.com'));
      console.log('Provisioned:', signature);
      alert(`Provisioned 0.05 SOL to Agent. Sig: ${signature.slice(0, 8)}...`);
    } catch (e) {
      console.error('Provisioning failed', e);
    }
    setProvisioning(false);
  };

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/status');
        const status = await res.json();
        setData(status);
      } catch (e) { console.error(e); }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
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

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white">
      {/* High Contrast Header */}
      <nav className="fixed top-0 w-full h-20 bg-white border-b-2 border-black z-50 flex items-center justify-between px-8">
        <div className="flex items-center gap-6">
          <div className="w-10 h-10 bg-black flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white rotate-45" />
          </div>
          <span className="font-mono text-sm font-black tracking-tighter uppercase italic">IBRL_CORE_SYSTEM</span>
        </div>
        <div className="flex items-center gap-6">
          <StatusBadge label={data?.riskLevel || "OFFLINE"} active={true} />
          <div className="wallet-adapter-custom">
            <WalletMultiButton className="!bg-black !text-white !rounded-none !font-mono !text-[12px] !uppercase !tracking-[0.2em] !h-12 !px-8 !border-none !shadow-none hover:!opacity-80 transition-all" />
          </div>
        </div>
      </nav>

      <main className="pt-32 px-8 max-w-[1400px] mx-auto pb-24">
        {/* Title Section */}
        <div className="mb-20">
          <h1 className="text-[12vw] font-black leading-[0.8] tracking-tighter uppercase mb-8">
            SOVEREIGN<br/>AGENT
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 border-t-2 border-black pt-8">
            <p className="font-mono text-base font-bold uppercase leading-tight max-w-xl">
              DECENTRALIZED RISK MITIGATION ENGINE. <br/>
              AUTONOMOUS ASSET MANAGEMENT. <br/>
              ZERO TRUST ARCHITECTURE.
            </p>
            <div className="flex flex-col gap-2 font-mono text-xs font-bold uppercase">
              <div className="flex justify-between border-b border-black/10 pb-2">
                <span>Network Status</span>
                <span className="text-[#1A3C2B]">CONNECTED_MAINNET</span>
              </div>
              <div className="flex justify-between border-b border-black/10 pb-2">
                <span>User Session</span>
                <span>{connected ? `ACTIVE [${publicKey?.toBase58().slice(0,8)}]` : 'DISCONNECTED'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Data Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-black border-2 border-black mb-16">
          {[
            ['SOL / USD', `$${data?.solPrice?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'}`],
            ['Vault Balance', `${data?.balance?.toFixed(4) || '0.0000'} SOL`],
            ['Solana Epoch', data?.currentEpoch || '---'],
            ['Agent Uptime', data?.uptime || '0H 0M']
          ].map(([label, val]) => (
            <div key={label} className="bg-white p-10 group hover:bg-black transition-colors duration-300">
              <span className="font-mono text-xs uppercase font-black text-black/40 group-hover:text-white/40 tracking-[0.2em]">{label}</span>
              <h3 className="text-5xl font-black mt-4 group-hover:text-white transition-colors">{val}</h3>
            </div>
          ))}
        </div>

        {/* Agent ID Bar */}
        <div className="mb-16 bg-black text-white p-6 font-mono text-sm font-bold flex flex-col md:flex-row justify-between items-center gap-4">
           <div className="flex items-center gap-4">
              <span className="text-[#9EFFBF]">AGENT_PROXY_ADDR:</span>
              <span className="break-all">{data?.walletAddress || 'INITIALIZING...'}</span>
           </div>
           <button 
             onClick={handleProvision}
             disabled={!connected || provisioning}
             className="bg-[#9EFFBF] text-black px-6 py-2 uppercase tracking-tighter hover:opacity-90 disabled:opacity-30 transition-all"
           >
             {provisioning ? 'SYNCING...' : 'PROVISION_CAPITAL_0.05_SOL'}
           </button>
        </div>

        {/* Command Center */}
        <div className="relative border-2 border-black p-12 bg-white mb-16">
          <CornerMarkers />
          <div className="flex items-center gap-3 mb-10">
            <div className="w-3 h-3 bg-black animate-pulse" />
            <h2 className="font-mono text-sm uppercase font-black tracking-[0.3em]">Command_Protocol_Alpha</h2>
          </div>
          
          <form onSubmit={handleCommand} className="flex flex-col gap-6">
            <div className="relative">
              <input 
                type="text" 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="INPUT STRATEGIC GOAL (E.G. CHASE 10% APY)"
                className="w-full bg-[#F2F2F2] border-2 border-black p-8 font-mono text-xl font-bold text-black placeholder:text-black/20 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[#9EFFBF]/30 transition-all uppercase"
              />
            </div>
            <button 
              disabled={loading}
              className="bg-black text-white p-8 font-mono text-lg font-black uppercase tracking-[0.4em] hover:bg-[#1A3C2B] disabled:opacity-50 transition-all"
            >
              {loading ? 'ANALYZING_INTENT...' : 'EXECUTE_STRATEGY'}
            </button>
          </form>

          {plan.length > 0 && (
            <div className="mt-12 pt-12 border-t-2 border-black space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <h3 className="font-mono text-xs font-black uppercase tracking-[0.2em] mb-8">Generated_Sequence:</h3>
              <div className="grid grid-cols-1 gap-4">
                {plan.map((step, i) => (
                  <div key={i} className="flex items-stretch gap-6 group">
                    <div className="w-16 bg-black text-white flex items-center justify-center font-mono text-xl font-bold">
                      0{i+1}
                    </div>
                    <div className="flex-1 border-2 border-black p-6 hover:bg-[#9EFFBF]/10 transition-colors">
                      <div className="font-mono text-xs font-black text-black uppercase mb-1">{step.type}</div>
                      <div className="font-mono text-sm font-bold text-black/60 uppercase">{step.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Telemetry Terminal */}
        <div className="bg-black text-white p-10 font-mono text-sm">
           <div className="flex justify-between items-center mb-10 border-b border-white/20 pb-6">
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 bg-[#9EFFBF]" />
                <span className="font-black uppercase tracking-[0.3em]">Telemetry_Stream</span>
              </div>
              <div className="flex gap-8 text-[10px] font-bold opacity-40">
                <span>SECURE_LINK: {connected ? 'ESTABLISHED' : 'PENDING'}</span>
                <span>ENC: AES-256</span>
              </div>
           </div>
           
           <div className="space-y-4 opacity-80">
             <div className="flex gap-8">
               <span className="text-[#9EFFBF] min-w-[80px]">[{new Date().toLocaleTimeString([], {hour12: false})}]</span>
               <span className="uppercase tracking-tight font-bold">System_Check_Complete: All_Modules_Optimal</span>
             </div>
             <div className="flex gap-8">
               <span className="text-[#9EFFBF] min-w-[80px]">[{new Date().toLocaleTimeString([], {hour12: false})}]</span>
               <span className="uppercase tracking-tight font-bold">Network_Heartbeat: {connected ? `Human_Node_${publicKey?.toBase58().slice(0,12)}...` : 'Waiting_For_Human_Authority'}</span>
             </div>
             <div className="flex gap-8 animate-pulse text-[#9EFFBF]">
               <span className="min-w-[80px]">[{new Date().toLocaleTimeString([], {hour12: false})}]</span>
               <span className="uppercase tracking-widest font-black">Standing_By_For_Capital_Authorization_Signals</span>
             </div>
           </div>
        </div>
      </main>

      <footer className="p-8 border-t-2 border-black font-mono text-[10px] font-black uppercase tracking-[0.5em] text-center">
        IBRL_Sovereign_Vault_v1.0.1 // Solana_Mainnet // End_Of_Line
      </footer>
    </div>
  );
}
