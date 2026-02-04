
'use client';

import React, { useEffect, useState } from 'react';
import { WalletContextProvider } from './WalletContextProvider';

export default function ClientWalletProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return <WalletContextProvider>{children}</WalletContextProvider>;
}
