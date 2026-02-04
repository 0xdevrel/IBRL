
'use client';

import React, { useEffect, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function WalletButton() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="h-11 min-w-[220px] rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-white/50 animate-pulse" />
        );
    }

    return (
        <div className="wallet-adapter-custom">
            <WalletMultiButton className="!h-11 !min-w-[220px] !justify-center" />
        </div>
    );
}
