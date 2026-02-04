
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

export function WalletButton() {
    const [mounted, setMounted] = useState(false);
    const { publicKey, connected, disconnecting, connecting, wallet, disconnect } = useWallet();
    const { setVisible } = useWalletModal();

    useEffect(() => {
        setMounted(true);
    }, []);

    const label = useMemo(() => {
        if (!mounted) return '…';
        if (connecting) return 'Connecting';
        if (disconnecting) return 'Disconnecting';
        if (!connected) return 'Select Wallet';
        const key = publicKey?.toBase58() || '';
        const shortKey = key ? `${key.slice(0, 4)}…${key.slice(-4)}` : 'Connected';
        const walletName = wallet?.adapter?.name ? `${wallet.adapter.name}` : 'Wallet';
        return `${walletName} • ${shortKey}`;
    }, [mounted, connecting, disconnecting, connected, publicKey, wallet]);

    if (!mounted) {
        return (
            <div className="h-11 min-w-[220px] rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white/50 animate-pulse" />
        );
    }

    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                className="h-11 max-w-[320px] rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-[var(--color-forest)] px-5 tech-button text-[12px] leading-none text-[var(--color-paper)] inline-flex items-center justify-center whitespace-nowrap text-center overflow-hidden hover:opacity-90 transition-opacity duration-150 ease-out disabled:opacity-50"
                onClick={() => setVisible(true)}
                disabled={connecting || disconnecting}
            >
                <span className="truncate">{label}</span>
            </button>
            {connected && (
                <button
                    type="button"
                    className="h-11 rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-transparent px-4 tech-button ink-dim hover:text-[var(--color-forest)] inline-flex items-center justify-center whitespace-nowrap"
                    onClick={() => disconnect()}
                    disabled={disconnecting}
                >
                    Disconnect
                </button>
            )}
        </div>
    );
}
