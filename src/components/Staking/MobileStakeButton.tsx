"use client";

import { useRouter } from "next/navigation";

/**
 * Mobile Stake Button - Floating action button for mobile
 */
export default function MobileStakeButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push('/staking')}
      className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg transition hover:from-purple-600 hover:to-blue-600 md:hidden"
      title="Stake KOHAI"
    >
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
  );
}
