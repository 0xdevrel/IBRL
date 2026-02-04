
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
            <div className="h-12 px-10 bg-black/10 animate-pulse border-2 border-black" />
        );
    }

    return (
        <div className="wallet-adapter-custom">
            <WalletMultiButton className="!bg-black !text-white !rounded-none !font-mono !text-[12px] !uppercase !h-12 !px-10 !border-none !shadow-none hover:!opacity-80 transition-all" />
        </div>
    );
}
