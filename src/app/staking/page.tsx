"use client";

import { useState } from "react";
import { useStaking } from "@/hooks/useStaking";
import { useWallet } from "@/contexts/WalletContext";
import StoreLayout from "@/components/Layouts/StoreLayout";

export default function StakingPage() {
  const { isConnected, connect } = useWallet();
  const { stats, loading, error, isReady, stake, unstake, claimRewards } =
    useStaking();

  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);

  const handleStake = async () => {
    if (!stakeAmount || isNaN(Number(stakeAmount))) {
      setTxError("Please enter a valid amount");
      return;
    }

    setProcessing(true);
    setTxError(null);
    setTxSuccess(null);

    try {
      const signature = await stake(Number(stakeAmount));
      setTxSuccess(`Successfully staked ${stakeAmount} KOHAI! Tx: ${signature}`);
      setStakeAmount("");
    } catch (err: any) {
      setTxError(err.message || "Failed to stake tokens");
    } finally {
      setProcessing(false);
    }
  };

  const handleUnstake = async () => {
    if (!unstakeAmount || isNaN(Number(unstakeAmount))) {
      setTxError("Please enter a valid amount");
      return;
    }

    setProcessing(true);
    setTxError(null);
    setTxSuccess(null);

    try {
      const signature = await unstake(Number(unstakeAmount));
      setTxSuccess(
        `Successfully unstaked ${unstakeAmount} KOHAI! Tx: ${signature}`
      );
      setUnstakeAmount("");
    } catch (err: any) {
      setTxError(err.message || "Failed to unstake tokens");
    } finally {
      setProcessing(false);
    }
  };

  const handleClaimRewards = async () => {
    setProcessing(true);
    setTxError(null);
    setTxSuccess(null);

    try {
      const signature = await claimRewards();
      setTxSuccess(`Successfully claimed rewards! Tx: ${signature}`);
    } catch (err: any) {
      setTxError(err.message || "Failed to claim rewards");
    } finally {
      setProcessing(false);
    }
  };

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return "Unlocked";

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  return (
    <StoreLayout>
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header Section with Gradient */}
        <div className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-[2px]">
          <div className="rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 text-2xl shadow-lg">
                <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  KOHAI Token Staking
                </h1>
                <p className="text-gray-400 mt-1">
                  Stake your KOHAI tokens to earn rewards. The longer you stake, the more you earn.
                </p>
              </div>
            </div>
          </div>
        </div>

        {!isConnected ? (
          <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-[2px]">
            <div className="rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-10 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                <svg className="h-10 w-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="mb-4 text-2xl font-semibold text-white">
                Connect Your Wallet
              </h2>
              <p className="mb-6 text-gray-400">
                Please connect your wallet to start staking KOHAI tokens
              </p>
              <button
                onClick={connect}
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 px-10 py-4 text-center font-medium text-white transition-all hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25"
              >
                Connect Wallet
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            {isReady && stats && (
              <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Total Staked */}
                <div className="group overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-blue-400 p-[2px] transition-all hover:scale-[1.02]">
                  <div className="h-full rounded-2xl bg-gray-900 p-6">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-400">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Total Staked
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {stats.totalStaked.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      <span className="ml-2 text-sm font-normal text-blue-400">KOHAI</span>
                    </div>
                  </div>
                </div>

                {/* Your Staked */}
                <div className="group overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 to-purple-400 p-[2px] transition-all hover:scale-[1.02]">
                  <div className="h-full rounded-2xl bg-gray-900 p-6">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-purple-400">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Your Staked
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {stats.userStaked.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      <span className="ml-2 text-sm font-normal text-purple-400">KOHAI</span>
                    </div>
                  </div>
                </div>

                {/* Pending Rewards */}
                <div className="group overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-400 p-[2px] transition-all hover:scale-[1.02]">
                  <div className="h-full rounded-2xl bg-gray-900 p-6">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-400">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Pending Rewards
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">
                      {stats.pendingRewards.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      <span className="ml-2 text-sm font-normal">KOHAI</span>
                    </div>
                  </div>
                </div>

                {/* APY */}
                <div className="group overflow-hidden rounded-2xl bg-gradient-to-r from-pink-600 to-pink-400 p-[2px] transition-all hover:scale-[1.02]">
                  <div className="h-full rounded-2xl bg-gray-900 p-6">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-pink-400">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      APY
                    </div>
                    <div className="text-2xl font-bold text-pink-400">
                      {(stats.apy * 100).toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error/Success Messages */}
            {(error || txError) && (
              <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                <p className="text-red-400">{error || txError}</p>
              </div>
            )}

            {txSuccess && (
              <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-emerald-400">{txSuccess}</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              {/* Stake Card */}
              <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 p-[2px]">
                <div className="h-full rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
                  <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
                      <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-semibold text-white">
                      Stake KOHAI
                    </h2>
                  </div>

                  <div className="mb-6">
                    <label className="mb-3 block text-sm font-medium text-gray-400">
                      Amount
                    </label>
                    <input
                      type="number"
                      placeholder="Enter amount to stake"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      disabled={processing || loading}
                      className="w-full rounded-xl border border-gray-700 bg-gray-800/50 px-5 py-4 text-white placeholder-gray-500 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>

                  <button
                    onClick={handleStake}
                    disabled={processing || loading || !isReady}
                    className="w-full rounded-xl bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 p-4 font-medium text-white transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {processing ? "Processing..." : "Stake"}
                  </button>

                  {stats && stats.lockPeriod > 0 && (
                    <p className="mt-4 text-sm text-gray-500">
                      Lock period: {Math.floor(stats.lockPeriod / 86400)} days
                    </p>
                  )}
                </div>
              </div>

              {/* Unstake Card */}
              <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 p-[2px]">
                <div className="h-full rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
                  <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-red-500">
                      <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-semibold text-white">
                      Unstake KOHAI
                    </h2>
                  </div>

                  <div className="mb-6">
                    <label className="mb-3 block text-sm font-medium text-gray-400">
                      Amount
                    </label>
                    <input
                      type="number"
                      placeholder="Enter amount to unstake"
                      value={unstakeAmount}
                      onChange={(e) => setUnstakeAmount(e.target.value)}
                      disabled={processing || loading || !stats?.canUnstake}
                      className="w-full rounded-xl border border-gray-700 bg-gray-800/50 px-5 py-4 text-white placeholder-gray-500 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>

                  <button
                    onClick={handleUnstake}
                    disabled={processing || loading || !isReady || !stats?.canUnstake}
                    className="w-full rounded-xl bg-gradient-to-r from-orange-500 via-red-500 to-orange-500 p-4 font-medium text-white transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-red-500/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {processing ? "Processing..." : "Unstake"}
                  </button>

                  {stats && !stats.canUnstake && (
                    <p className="mt-4 text-sm text-orange-400">
                      {formatTimeRemaining(stats.timeUntilUnlock)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Claim Rewards Card */}
            {stats && stats.pendingRewards > 0 && (
              <div className="mt-8 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 p-[2px]">
                <div className="rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500">
                        <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-2xl font-semibold text-white">
                          Claim Your Rewards
                        </h2>
                        <p className="text-gray-400">
                          You have{" "}
                          <span className="font-bold text-emerald-400">
                            {stats.pendingRewards.toLocaleString(undefined, { maximumFractionDigits: 2 })} KOHAI
                          </span>{" "}
                          ready to claim
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleClaimRewards}
                      disabled={processing || loading || !isReady}
                      className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-4 font-medium text-white transition-all hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                    >
                      {processing ? "Processing..." : "Claim Rewards"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="mt-8 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-[2px]">
                <div className="rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-10 text-center">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent mx-auto"></div>
                  <p className="mt-4 text-gray-400">
                    Loading staking data...
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </StoreLayout>
  );
}
