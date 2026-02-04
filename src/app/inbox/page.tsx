'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const InboxCore = dynamic(() => import('@/components/InboxCore'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center">
      <div className="font-mono text-black animate-pulse">LOADING INBOX...</div>
    </div>
  ),
});

export default function Page() {
  return (
    <Suspense fallback={null}>
      <InboxCore />
    </Suspense>
  );
}

