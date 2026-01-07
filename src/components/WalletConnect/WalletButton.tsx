"use client";

import { useWallet } from "@/contexts/WalletContext";
import { useCurrentUserQuery } from "graphql/generated/graphql";
import { useEmailVerification } from "@/contexts/EmailVerificationContext";
import UserTierDisplay from "@/components/User/UserTierDisplay";
import TierBadge from "@/components/User/TierBadge";
import ReferralModal from "@/components/User/ReferralModal";
import { useState, useEffect } from "react";

/**
 * Compact Wallet Button for Header
 * Shows:
 * - "Connect Wallet" button when not connected
 * - Wallet icon + shortened address when connected
 * - Email verification status badge
 * - Balance on hover/click
 */

const WalletButton = () => {
  const { isConnected, address, connect, disconnect, getBalance, getTokenBalance, isConnecting, authError, clearAuthError } = useWallet();
  const { data: currentUserData, refetch: refetchUserData, loading: userDataLoading } = useCurrentUserQuery({
    skip: !isConnected || !address,
    fetchPolicy: 'cache-and-network', // Use cache first for instant display, then fetch fresh
    notifyOnNetworkStatusChange: true,
  });
  const { openEmailModal } = useEmailVerification();
  const [mounted, setMounted] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [forceRender, setForceRender] = useState(0);
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Refetch user data when wallet address changes OR when no data is available
  useEffect(() => {
    // Only refetch if connected but we have no user data
    // This handles: initial mount, navigation to new pages, and address changes
    const needsData = isConnected && address && currentUserData === undefined && !userDataLoading;

    if (needsData) {
      console.log('🔄 No user data available - fetching...');
      setIsLoadingUserData(true);

      // Set a maximum timeout but also check if data is actually loaded
      const maxTimeout = setTimeout(() => {
        console.log('⏱️ Max timeout reached, hiding loading state');
        setIsLoadingUserData(false);
      }, 2000); // Maximum 2 seconds

      refetchUserData().then((result) => {
        console.log('✅ User data fetched:', result.data?.currentUser);

        // Check if we actually got data or if it's empty
        const hasActualData = result.data?.currentUser !== null && result.data?.currentUser !== undefined;

        if (hasActualData) {
          console.log('✅ Got actual user data, hiding loading state after small delay');
          // Small delay to ensure data is rendered
          setTimeout(() => {
            clearTimeout(maxTimeout);
            setIsLoadingUserData(false);
          }, 200);
        } else {
          console.log('⚠️ No user data returned, keeping loading state (will timeout at 2s)');
          // Don't hide loading - let the timeout handle it or wait for data to populate
        }
      }).catch((error) => {
        console.error('❌ Error fetching user data:', error);
        clearTimeout(maxTimeout);
        setIsLoadingUserData(false);
      });

      return () => clearTimeout(maxTimeout);
    } else if (!isConnected || !address) {
      setIsLoadingUserData(false);
    }
  }, [address, isConnected, currentUserData, userDataLoading, refetchUserData]);

  // Refetch when dropdown opens to show latest status
  useEffect(() => {
    if (showDropdown && isConnected) {
      console.log('🔄 Dropdown opened - refetching user data');
      refetchUserData().then((result) => {
        console.log('✅ Dropdown refetch complete:', result.data?.currentUser);
        // Force re-render to update badge
        setForceRender(prev => prev + 1);
      });
    }
  }, [showDropdown, isConnected, refetchUserData]);

  // Listen for email verification success event
  useEffect(() => {
    const handleEmailVerified = () => {
      console.log('🔄 Email verified event received - refreshing user data in WalletButton');
      refetchUserData();
    };

    window.addEventListener('email-verified', handleEmailVerified);
    return () => window.removeEventListener('email-verified', handleEmailVerified);
  }, [refetchUserData]);

  // Listen for wallet switch event
  useEffect(() => {
    const handleWalletSwitch = async (event: any) => {
      console.log('🔄 Wallet switched event received in WalletButton');
      console.log('Previous:', event.detail.previousAddress);
      console.log('New:', event.detail.newAddress);

      // Show loading state
      setIsLoadingUserData(true);

      // Optimized: Poll for JWT token instead of fixed delay
      console.log('Waiting for backend authentication...');
      let attempts = 0;
      const maxAttempts = 20; // 2 seconds max (20 * 100ms)

      const waitForAuth = async () => {
        while (attempts < maxAttempts) {
          const jwtToken = window.localStorage.getItem('jwtToken');
          if (jwtToken) {
            console.log('✅ JWT token found, authentication complete');
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (attempts >= maxAttempts) {
          console.log('⚠️ Authentication timeout, proceeding anyway');
        }
      };

      await waitForAuth();

      // Small delay after auth completes
      await new Promise(resolve => setTimeout(resolve, 200));

      // Force refetch user data
      console.log('Refetching user data from network...');
      try {
        const result = await refetchUserData();
        console.log('✅ User data refetched successfully:', result.data?.currentUser);

        // Small delay for data to populate
        await new Promise(resolve => setTimeout(resolve, 200));

        // Force component to re-render with new data
        setForceRender(prev => prev + 1);
        setIsLoadingUserData(false);
      } catch (error) {
        console.error('❌ Error refetching user data:', error);
        setIsLoadingUserData(false);
      }

      // Refetch USDT balance for new wallet
      if (event.detail.newAddress) {
        console.log('Fetching USDT balance for new wallet...');
        try {
          const newBalance = await getTokenBalance('USDT');
          setBalance(newBalance);
          console.log('✅ USDT Balance updated:', newBalance);
        } catch (error) {
          console.error('❌ Error fetching USDT balance:', error);
        }
      }
    };

    window.addEventListener('wallet-switched', handleWalletSwitch);
    return () => window.removeEventListener('wallet-switched', handleWalletSwitch);
  }, [refetchUserData, getTokenBalance]);

  // Force re-render when user data changes AND hide loading state
  useEffect(() => {
    // Only process if we have actual user data (not null/undefined)
    const hasUserData = currentUserData?.currentUser !== null && currentUserData?.currentUser !== undefined;

    if (hasUserData) {
      console.log('📧 User data updated in WalletButton:', {
        email: currentUserData.currentUser?.email,
        verified: currentUserData.currentUser?.emailVerified,
        address: address,
        loading: userDataLoading,
        isLoadingUserData
      });

      // If we have data and not actively loading from GraphQL, hide loading state
      if (!userDataLoading && isLoadingUserData) {
        console.log('✅ Data available and not loading, hiding loading state');
        // Small delay to ensure render completes
        setTimeout(() => {
          setIsLoadingUserData(false);
        }, 100);
      }

      // Trigger re-render to update badges
      setForceRender(prev => prev + 1);
    } else if (currentUserData !== undefined && !userDataLoading) {
      // Query completed but returned null/no user data
      console.log('⚠️ Query completed but no user data - hiding loading anyway');
      setIsLoadingUserData(false);
    }
  }, [currentUserData, userDataLoading, address, isLoadingUserData]);

  // Fetch USDT balance when connected
  useEffect(() => {
    if (isConnected && address) {
      console.log('🔍 Fetching USDT balance for address:', address);
      getTokenBalance('USDT')
        .then((bal) => {
          console.log('✅ USDT balance fetched:', bal);
          setBalance(bal);
        })
        .catch((err) => {
          console.error('❌ Error fetching USDT balance:', err);
          setBalance(null);
        });
    } else {
      console.log('⚠️ Not connected or no address');
      setBalance(null);
      setShowDropdown(false); // Close dropdown when disconnected
    }
  }, [isConnected, address, getTokenBalance]);

  // Shorten address for display (0x1234...5678)
  const shortenAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  // Prevent hydration mismatch - show loading state during SSR
  if (!mounted) {
    return (
      <button
        disabled
        className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white/50 transition"
      >
        <WalletIcon />
        <span className="hidden sm:inline">Loading...</span>
      </button>
    );
  }

  // Function to clear WalletConnect cache manually
  const clearWalletCache = () => {
    if (typeof window !== 'undefined') {
      console.log('🧹 Manually clearing all wallet cache...');
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && (
          key.startsWith('wc@2:') ||
          key.startsWith('@w3m/') ||
          key.startsWith('W3M_') ||
          key.includes('walletconnect') ||
          key.includes('reown') ||
          key.includes('wagmi')
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => window.localStorage.removeItem(key));

      // Also clear session storage
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key && (key.startsWith('wc@2:') || key.includes('walletconnect') || key.includes('reown'))) {
          window.sessionStorage.removeItem(key);
        }
      }

      console.log('✅ Cache cleared. Reloading page...');
      window.location.reload();
    }
  };

  if (!isConnected) {
    return (
      <>
        <button
          onClick={connect}
          disabled={isConnecting}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white transition hover:from-blue-600 hover:to-purple-600 disabled:opacity-50"
        >
          {isConnecting ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Connecting...
            </>
          ) : (
            <>
              <WalletIcon />
              <span className="hidden sm:inline">Connect Wallet</span>
            </>
          )}
        </button>

        {/* Error banner with cache clear option */}
        {authError && !isConnected && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] w-full max-w-md px-4">
            <div className="rounded-lg bg-red-500/95 backdrop-blur-md border border-red-600 p-4 shadow-2xl">
              <div className="flex items-start gap-3">
                <svg className="h-6 w-6 text-white flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h3 className="font-bold text-white mb-1">Connection Error</h3>
                  <p className="text-sm text-white/90 mb-3">{authError}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={clearWalletCache}
                      className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white font-semibold text-xs transition"
                    >
                      Clear Cache & Retry
                    </button>
                    <button
                      onClick={clearAuthError}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
                <button
                  onClick={clearAuthError}
                  className="text-white/70 hover:text-white transition"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Get email verification status
  const user = currentUserData?.currentUser;
  const hasEmail = !!user?.email;
  const isEmailVerified = !!user?.emailVerified;

  // Calculate tier info from tier name if backend values are missing - MATCH BACKEND CONFIG
  const getTierInfo = (tierName: string | null | undefined) => {
    if (!tierName) return null;
    const lowerTier = tierName.toLowerCase();
    if (lowerTier === "elite") return { discount: 1, style: "silver" };
    if (lowerTier === "grandmaster") return { discount: 2, style: "gold" };
    if (lowerTier === "legend") return { discount: 3, style: "orange" };
    return null;
  };

  const tierInfo = getTierInfo(user?.tierName);

  // Always use backend discountPercent if provided (>= 0), otherwise fallback to tier config
  const actualDiscount = (user?.discountPercent !== undefined && user?.discountPercent !== null && user.discountPercent >= 0)
    ? user.discountPercent
    : (tierInfo?.discount || 0);

  const actualStyle = user?.tierStyle || (tierInfo?.style || null);

  // Show loading if:
  // 1. Explicitly loading user data (isLoadingUserData = true)
  // 2. GraphQL query is loading (userDataLoading = true)
  // 3. Connected but no user data yet (initial fetch not complete)
  const isLoading = isLoadingUserData || userDataLoading || (isConnected && currentUserData === undefined);

  // Log badge status for debugging
  console.log('🏷️ WalletButton render - Badge status:', {
    hasEmail,
    isEmailVerified,
    email: user?.email,
    isLoading,
    isLoadingUserData,
    userDataLoading,
    currentUserDataDefined: currentUserData !== undefined,
    forceRender,
    address
  });

  return (
    <>
      {/* Authentication Error Banner */}
      {authError && isConnected && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] w-full max-w-2xl px-4">
          <div className="rounded-lg bg-orange-500/95 backdrop-blur-md border border-orange-600 p-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <svg className="h-6 w-6 text-white flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h3 className="font-bold text-white mb-1">Wallet Authentication Issue</h3>
                <p className="text-sm text-white/90 mb-3">{authError}</p>
                <div className="bg-white/10 rounded-lg p-3 mb-3 text-sm text-white">
                  <p className="font-semibold mb-2">To fix this:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Open your Phantom wallet</li>
                    <li>Switch to the account you want to use</li>
                    <li>The app will automatically detect the change</li>
                  </ol>
                  <p className="mt-2 text-xs text-white/70">Or disconnect and try connecting a different wallet.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      disconnect();
                      clearAuthError();
                    }}
                    className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white font-semibold text-sm transition"
                  >
                    Disconnect Wallet
                  </button>
                  <button
                    onClick={clearAuthError}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <button
                onClick={clearAuthError}
                className="text-white/70 hover:text-white transition"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative" key={`wallet-${address}-${forceRender}`}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium backdrop-blur-md transition hover:bg-white/20"
        >
          <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <WalletIcon />
          <span className="hidden sm:inline font-mono">{shortenAddress(address!)}</span>

          {/* Tier Badge - Always visible */}
          {!isLoading && user?.tier && (
            <div className="hidden lg:flex ml-1">
              <TierBadge
                tierName={user.tierName || null}
                tierStyle={actualStyle}
                discountPercent={actualDiscount}
                compact
              />
            </div>
          )}

          {/* Email Verification Badge */}
          {isLoading ? (
            <span className="hidden md:flex items-center gap-1 ml-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold border border-blue-500/30" title="Loading...">
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading...
            </span>
          ) : hasEmail && isEmailVerified ? (
            <span className="hidden md:flex items-center gap-1 ml-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-semibold border border-green-500/30" title="Email Verified">
              ✓ Verified
            </span>
          ) : hasEmail && !isEmailVerified ? (
            <span className="hidden md:flex items-center gap-1 ml-1 px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-xs font-semibold border border-orange-500/30" title="Email Not Verified">
              ⚠ Unverified
            </span>
          ) : (
            <span className="hidden md:flex items-center gap-1 ml-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/30" title="No Email">
              ✗ No Email
            </span>
          )}
        </button>

      {/* Dropdown menu */}
      {showDropdown && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />

          {/* Dropdown content */}
          <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-lg bg-gray-900 shadow-xl border border-white/10">
            <div className="p-4">
              {/* Address */}
              <div className="mb-3">
                <p className="text-xs text-gray-400 mb-1">Wallet Address</p>
                <p className="font-mono text-sm break-all">{address}</p>
              </div>

              {/* Balance */}
              <div className="mb-3 rounded-lg bg-white/5 p-3">
                <p className="text-xs text-gray-400 mb-1">USDT Balance</p>
                <p className="text-lg font-bold">
                  {balance !== null ? `${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} USDT` : 'Loading...'}
                </p>
              </div>

              {/* VIP Tier Status */}
              {!isLoading && user && (
                <div className="mb-3">
                  <UserTierDisplay
                    tier={user.tier || null}
                    tierName={user.tierName || null}
                    tierStyle={actualStyle}
                    discountPercent={actualDiscount}
                    kohaiBalance={user.kohaiBalance || 0}
                  />
                </div>
              )}

              {/* Email Verification Status */}
              <div className="mb-3">
                {isLoading ? (
                  <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/30 p-3">
                    <svg className="h-5 w-5 text-blue-400 flex-shrink-0 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-blue-400">Loading Email Status...</p>
                      <p className="text-xs text-blue-300/70">Please wait</p>
                    </div>
                  </div>
                ) : hasEmail && isEmailVerified ? (
                  <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/30 p-3">
                    <svg className="h-5 w-5 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-green-400">Email Verified</p>
                      <p className="text-xs text-green-300/70 truncate">{user?.email}</p>
                    </div>
                  </div>
                ) : hasEmail && !isEmailVerified ? (
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      openEmailModal();
                    }}
                    className="w-full flex items-center gap-2 rounded-lg bg-orange-500/10 border border-orange-500/30 p-3 hover:bg-orange-500/20 transition"
                  >
                    <svg className="h-5 w-5 text-orange-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1 text-left">
                      <p className="text-xs font-semibold text-orange-400">Verify Email</p>
                      <p className="text-xs text-orange-300/70 truncate">{user?.email}</p>
                    </div>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      openEmailModal();
                    }}
                    className="w-full flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 p-3 hover:bg-red-500/20 transition"
                  >
                    <svg className="h-5 w-5 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1 text-left">
                      <p className="text-xs font-semibold text-red-400">Add Email</p>
                      <p className="text-xs text-red-300/70">Required for purchases</p>
                    </div>
                  </button>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    setShowReferralModal(true);
                  }}
                  className="flex items-center justify-center gap-2 w-full rounded-lg bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 px-4 py-2 text-sm font-semibold transition hover:from-purple-500/30 hover:to-blue-500/30"
                >
                  <svg
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                  </svg>
                  💰 Referral Rewards
                </button>
                <a
                  href="/swap"
                  onClick={() => setShowDropdown(false)}
                  className="flex items-center justify-center gap-2 w-full rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 px-4 py-2 text-sm font-semibold transition hover:from-purple-500/30 hover:to-pink-500/30"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                    />
                  </svg>
                  Swap Tokens
                </a>
                <a
                  href="/staking"
                  onClick={() => setShowDropdown(false)}
                  className="flex items-center justify-center gap-2 w-full rounded-lg bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 px-4 py-2 text-sm font-semibold transition hover:from-blue-500/30 hover:to-cyan-500/30"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Stake KOHAI
                </a>
                <a
                  href="/topups"
                  className="flex items-center justify-center gap-2 w-full rounded-lg bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 px-4 py-2 text-sm font-semibold transition hover:from-green-500/30 hover:to-emerald-500/30"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Topups
                </a>
                <a
                  href="/orders"
                  className="flex items-center justify-center gap-2 w-full rounded-lg bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 px-4 py-2 text-sm font-semibold transition hover:from-blue-500/30 hover:to-cyan-500/30"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  My Orders
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(address!);
                    // Could add a toast notification here
                  }}
                  className="w-full rounded-lg bg-blue-500/20 px-4 py-2 text-sm font-medium text-blue-300 transition hover:bg-blue-500/30"
                >
                  📋 Copy Address
                </button>
                <button
                  onClick={disconnect}
                  className="w-full rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/30"
                >
                  🔌 Disconnect
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      </div>

      {/* Referral Modal */}
      <ReferralModal
        isOpen={showReferralModal}
        onClose={() => setShowReferralModal(false)}
      />
    </>
  );
};

// Wallet icon component
const WalletIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
    />
  </svg>
);

export default WalletButton;
