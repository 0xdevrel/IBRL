'use client';

import React, { FC, ReactNode, useState } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { useStandardWalletAdapters } from '@solana/wallet-standard-wallet-adapter-react';

import '@solana/wallet-adapter-react-ui/styles.css';

export const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
    // Wallet adapter requires an absolute http(s) URL (not a relative path).
    // Use same-origin proxy so provider keys never ship to the browser and to avoid vendor origin restrictions.
    const [endpoint] = useState(() => {
        if (typeof window === 'undefined') {
            return 'https://api.mainnet-beta.solana.com';
        }
        return new URL('/api/rpc', window.location.origin).toString();
    });

    // Use Wallet Standard to auto-detect wallets like Phantom/Solflare/etc.
    const wallets = useStandardWalletAdapters([]);

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};
