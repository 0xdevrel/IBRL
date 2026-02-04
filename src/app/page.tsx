'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Dynamically import the core dashboard component with SSR disabled.
// This ensures that all wallet-related logic only runs in the browser.
const DashboardCore = dynamic(() => import('@/components/DashboardCore'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center">
      <div className="font-mono text-black animate-pulse">INITIALIZING SYSTEM...</div>
    </div>
  ),
});

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DashboardCore />
    </Suspense>
  );
}
