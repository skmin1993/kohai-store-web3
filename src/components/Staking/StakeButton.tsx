"use client";

import { useRouter } from "next/navigation";

interface StakeButtonProps {
  className?: string;
}

/**
 * Stake Button - Opens staking page
 * Allows users to stake KOHAI tokens for rewards
 */
export default function StakeButton({ className }: StakeButtonProps) {
  const router = useRouter();

  const handleStake = () => {
    router.push('/staking');
  };

  return (
    <button
      onClick={handleStake}
      className={className || "flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:from-purple-600 hover:to-blue-600"}
      title="Stake KOHAI tokens"
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Stake KOHAI
    </button>
  );
}
