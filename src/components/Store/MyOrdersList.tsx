"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMyOrdersQuery, useAuthenticateWalletMutation } from "graphql/generated/graphql";
import { useWallet } from "@/contexts/WalletContext";
import Link from "next/link";
import Loader from "@/components/common/Loader";

const MyOrdersList = () => {
  const router = useRouter();
  const { isConnected, address } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [authenticating, setAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const ORDERS_PER_PAGE = 20;
  const [authenticateWallet] = useAuthenticateWalletMutation();

  // Track if wallet context has initialized
  const [walletInitialized, setWalletInitialized] = useState(false);

  // Prevent hydration mismatch by only running client-side logic after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Wait for wallet context to initialize before checking connection
  useEffect(() => {
    if (mounted) {
      // Give wallet context time to restore connection state
      const timer = setTimeout(() => {
        setWalletInitialized(true);
      }, 500); // Small delay to allow wallet to restore
      return () => clearTimeout(timer);
    }
  }, [mounted]);

  // Redirect to home if wallet not connected (only after wallet initialized)
  useEffect(() => {
    if (walletInitialized && (!isConnected || !address)) {
      console.log("Wallet not connected, redirecting to home...");
      router.push("/");
    }
  }, [walletInitialized, isConnected, address, router]);

  // OPTIMIZATION 2: Memoize authentication check to avoid re-running
  const authenticateIfNeeded = useCallback(async () => {
    if (!mounted || !isConnected || !address) {
      setIsAuthenticated(false);
      return;
    }

    const jwtToken = window.localStorage.getItem('jwtToken');

    // If JWT token exists, mark as authenticated
    if (jwtToken) {
      console.log("JWT token found, marking as authenticated");
      setIsAuthenticated(true);
      return;
    }

    // If no JWT token, authenticate
    console.log("No JWT token found, authenticating...");
    setAuthenticating(true);
    setAuthError(null);

    try {
      const result = await authenticateWallet({
        variables: { walletAddress: address },
      });

      if (result.data?.authenticateWallet?.token) {
        window.localStorage.setItem('jwtToken', result.data.authenticateWallet.token);
        console.log("Authentication successful");
        setAuthenticating(false);
        setIsAuthenticated(true);
      } else if (result.data?.authenticateWallet?.errors) {
        setAuthError(result.data.authenticateWallet.errors.join(", "));
        setAuthenticating(false);
        setIsAuthenticated(false);
      }
    } catch (err: any) {
      console.error("Authentication error:", err);
      setAuthError(err.message || "Failed to authenticate");
      setAuthenticating(false);
      setIsAuthenticated(false);
    }
  }, [mounted, isConnected, address, authenticateWallet]);

  useEffect(() => {
    authenticateIfNeeded();
  }, [authenticateIfNeeded]);

  // Handle wallet switches - reset authentication when address changes
  useEffect(() => {
    const handleWalletSwitch = () => {
      console.log('MyOrdersList: Wallet switched, resetting authentication...');
      setIsAuthenticated(false);
      setAuthError(null);
      // Re-authentication will be triggered by the authenticateIfNeeded useEffect
    };

    const handleClearCache = () => {
      console.log('MyOrdersList: Clear cache event received');
      setIsAuthenticated(false);
    };

    window.addEventListener('wallet-switched', handleWalletSwitch);
    window.addEventListener('clear-apollo-cache', handleClearCache);

    return () => {
      window.removeEventListener('wallet-switched', handleWalletSwitch);
      window.removeEventListener('clear-apollo-cache', handleClearCache);
    };
  }, []);

  // OPTIMIZATION 3: Reduce initial fetch to 50 orders with better caching
  // SECURITY: myOrders query is automatically filtered by JWT token on backend
  // Only the authenticated user's orders are returned (not everyone's orders)
  const { data, loading, error, refetch } = useMyOrdersQuery({
    variables: { limit: 50 },
    skip: !isConnected || !address || authenticating || !isAuthenticated,
    fetchPolicy: 'cache-and-network', // Use cache first for instant display
    notifyOnNetworkStatusChange: true,
  });

  // Handle authentication errors from GraphQL queries
  useEffect(() => {
    if (mounted && error && error.message.includes('Authentication required')) {
      console.log('Authentication error detected, clearing JWT and re-authenticating...');
      // Clear potentially expired JWT token
      window.localStorage.removeItem('jwtToken');
      // Reset authentication state to trigger re-authentication
      setIsAuthenticated(false);
      // Trigger re-authentication
      authenticateIfNeeded();
    }
  }, [mounted, error, authenticateIfNeeded]);

  const orders = data?.myOrders || [];

  // OPTIMIZATION 4: Memoize expensive filtering operations
  const { filteredOrders, pendingCount, paidCount, completedCount, failedCount } = useMemo(() => {
    // Helper to check if status is "completed" (includes both "completed" and "succeeded")
    const isCompletedStatus = (status: string) => {
      const lower = status.toLowerCase();
      return lower === 'completed' || lower === 'succeeded';
    };

    const filtered = statusFilter === "all"
      ? orders
      : statusFilter === "completed"
        ? orders.filter(order => isCompletedStatus(order.status))
        : orders.filter(order => order.status.toLowerCase() === statusFilter.toLowerCase());

    return {
      filteredOrders: filtered,
      pendingCount: orders.filter(o => o.status.toLowerCase() === 'pending').length,
      paidCount: orders.filter(o => o.status.toLowerCase() === 'paid').length,
      completedCount: orders.filter(o => isCompletedStatus(o.status)).length,
      failedCount: orders.filter(o => o.status.toLowerCase() === 'failed').length,
    };
  }, [orders, statusFilter]);

  // OPTIMIZATION 5: Pagination for filtered orders
  const paginatedOrders = useMemo(() => {
    const startIndex = (page - 1) * ORDERS_PER_PAGE;
    const endIndex = startIndex + ORDERS_PER_PAGE;
    return filteredOrders.slice(startIndex, endIndex);
  }, [filteredOrders, page]);

  const totalPages = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'paid':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'completed':
      case 'succeeded':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'failed':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  // OPTIMIZATION 6: Skeleton loader component for better perceived performance
  const OrderSkeleton = () => (
    <div className="rounded-lg bg-white/10 p-6 backdrop-blur-md animate-pulse">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <div className="h-6 w-32 bg-white/20 rounded mb-2"></div>
          <div className="h-4 w-24 bg-white/10 rounded mb-1"></div>
          <div className="h-3 w-40 bg-white/10 rounded"></div>
        </div>
        <div className="text-right">
          <div className="h-8 w-24 bg-white/20 rounded mb-1 ml-auto"></div>
          <div className="h-4 w-32 bg-white/10 rounded ml-auto"></div>
        </div>
      </div>
    </div>
  );

  // Prevent hydration mismatch - show loading during SSR/hydration
  if (!mounted || !walletInitialized) {
    return (
      <div className="rounded-lg bg-white/10 p-8 text-center backdrop-blur-md">
        <Loader />
        <p className="mt-4 text-sm opacity-70">Loading...</p>
      </div>
    );
  }

  // Show loading while redirecting if wallet not connected (after initialization)
  if (!isConnected || !address) {
    return (
      <div className="rounded-lg bg-white/10 p-8 text-center backdrop-blur-md">
        <Loader />
        <p className="mt-4 text-sm opacity-70">Redirecting...</p>
      </div>
    );
  }

  if (authenticating) {
    return (
      <div className="rounded-lg bg-white/10 p-8 text-center backdrop-blur-md">
        <h2 className="mb-4 text-2xl font-bold">My Orders</h2>
        <Loader />
        <p className="mt-4 text-sm opacity-70">Authenticating wallet...</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-6">
        <h3 className="text-xl font-bold text-red-300">Authentication Error</h3>
        <p className="mt-2 text-red-200">{authError}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/30"
        >
          Try Again
        </button>
      </div>
    );
  }

  // OPTIMIZATION 7: Show skeleton loaders while loading instead of full page loader
  const isInitialLoading = loading && orders.length === 0;

  if (error) {
    return (
      <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-6">
        <h3 className="text-xl font-bold text-red-300">Error Loading Orders</h3>
        <p className="mt-2 text-red-200">{error.message}</p>
        <p className="mt-2 text-sm text-red-200/70">
          Check browser console for JWT token status
        </p>
        <button
          onClick={() => refetch()}
          className="mt-4 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/30"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg bg-white/10 p-6 backdrop-blur-md">
        <h1 className="text-3xl font-bold">My Orders</h1>
        <p className="mt-2 text-sm opacity-70">
          View and track your purchase orders
        </p>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter("all")}
          className={`rounded-lg px-4 py-2 font-semibold transition ${
            statusFilter === "all"
              ? "bg-blue-500 text-white"
              : "bg-white/10 hover:bg-white/20"
          }`}
        >
          All ({orders.length})
        </button>
        <button
          onClick={() => setStatusFilter("pending")}
          className={`rounded-lg px-4 py-2 font-semibold transition ${
            statusFilter === "pending"
              ? "bg-yellow-500 text-white"
              : "bg-white/10 hover:bg-white/20"
          }`}
        >
          Pending ({pendingCount})
        </button>
        <button
          onClick={() => setStatusFilter("paid")}
          className={`rounded-lg px-4 py-2 font-semibold transition ${
            statusFilter === "paid"
              ? "bg-blue-500 text-white"
              : "bg-white/10 hover:bg-white/20"
          }`}
        >
          Paid ({paidCount})
        </button>
        <button
          onClick={() => setStatusFilter("completed")}
          className={`rounded-lg px-4 py-2 font-semibold transition ${
            statusFilter === "completed"
              ? "bg-green-500 text-white"
              : "bg-white/10 hover:bg-white/20"
          }`}
        >
          Completed ({completedCount})
        </button>
        <button
          onClick={() => setStatusFilter("failed")}
          className={`rounded-lg px-4 py-2 font-semibold transition ${
            statusFilter === "failed"
              ? "bg-red-500 text-white"
              : "bg-white/10 hover:bg-white/20"
          }`}
        >
          Failed ({failedCount})
        </button>
      </div>

      {/* Orders List */}
      {isInitialLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <OrderSkeleton key={i} />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-lg bg-white/10 p-8 text-center backdrop-blur-md">
          <p className="text-lg opacity-70">
            {statusFilter === "all"
              ? "No orders found"
              : `No ${statusFilter} orders found`}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {paginatedOrders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="block rounded-lg bg-white/10 p-6 backdrop-blur-md transition hover:bg-white/20"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                {/* Order Info */}
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-3">
                    <h3 className="text-xl font-bold">{order.orderNumber}</h3>
                    <span className={`rounded border px-2 py-1 text-xs font-semibold uppercase ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-sm opacity-70">
                    Order Type: {order.orderType}
                  </p>
                  <p className="text-xs opacity-60 mt-1">
                    {mounted ? new Date(order.createdAt).toLocaleString() : '—'}
                  </p>
                </div>

                {/* Amount */}
                <div className="text-right">
                  <p className="text-2xl font-bold">
                    {order.amount} {order.currency}
                  </p>
                  {/* Show crypto amount from top-level fields if available and valid */}
                  {order.cryptoAmount && order.cryptoCurrency && typeof order.cryptoAmount === 'number' && (
                    <p className="text-sm opacity-70 mt-1">
                      {order.cryptoAmount.toFixed(6)} {order.cryptoCurrency}
                    </p>
                  )}
                  {/* Fallback to transaction data if top-level fields not available */}
                  {order.cryptoTransaction && (!order.cryptoAmount || typeof order.cryptoAmount !== 'number') && (
                    <p className="text-sm text-green-400 mt-1">
                      {typeof order.cryptoTransaction.amount === 'number'
                        ? order.cryptoTransaction.amount.toFixed(6)
                        : order.cryptoTransaction.amount} {order.cryptoTransaction.token}
                    </p>
                  )}
                </div>

                {/* Transaction Info */}
                {order.cryptoTransaction && (
                  <div className="flex-shrink-0">
                    <div className="rounded-lg bg-white/5 p-3">
                      <p className="text-xs opacity-60 mb-1">Network</p>
                      <p className="text-sm font-semibold">{order.cryptoTransaction.network}</p>
                    </div>
                  </div>
                )}
              </div>
            </Link>
          ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg bg-white/10 px-4 py-2 font-semibold transition hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>

              <span className="px-4 py-2 text-sm">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg bg-white/10 px-4 py-2 font-semibold transition hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MyOrdersList;
