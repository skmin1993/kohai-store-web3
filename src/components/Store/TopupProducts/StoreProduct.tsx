"use client";

import { useTopupProductQuery } from "graphql/generated/graphql";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

import Loader from "@/components/common/Loader";
import { useStore } from "@/contexts/StoreContext";
import GameBackground from "../GameBackground";
import GameFormSimple from "./GameFormSimple";
import GameInfo from "./GameInfo";

const StoreProduct = (props: { id: string; slug?: string }) => {
  const { store } = useStore();
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Check if props.id is a number (ID) or string (slug)
  const isNumericId = /^\d+$/.test(props.id);

  // Query with either id or slug parameter
  // Use cache-first for instant loading, then refresh in background
  const { data, loading, error, refetch } = useTopupProductQuery({
    variables: isNumericId
      ? { id: props.id, slug: undefined }
      : { id: undefined, slug: props.id },
    fetchPolicy: "cache-and-network", // Show cached data instantly, then update
    nextFetchPolicy: "cache-first", // Subsequent requests use cache
    pollInterval: 60000, // Refresh prices every 60 seconds
  });

  const product = data?.topupProduct;

  // Track user activity to detect if page is idle
  const handleActivity = useCallback(() => {
    setLastActivity(Date.now());
  }, []);

  // Set up activity listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Track clicks, keyboard, scroll, touch (mousemove excluded — fires too frequently)
    const events = ['mousedown', 'keypress', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [handleActivity]);

  // Auto-refresh product data to ensure fresh prices
  useEffect(() => {
    const AUTO_REFRESH_INTERVAL = 60 * 1000; // Check every 1 minute
    const INACTIVITY_THRESHOLD = 3 * 60 * 1000; // 3 minutes idle before refresh

    const checkRefresh = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivity;

      // If user has been inactive, silently refresh product data
      if (timeSinceActivity >= INACTIVITY_THRESHOLD) {
        console.log('Auto-refreshing product data (silent)...');
        refetch(); // Silently refetch product data
        setLastActivity(Date.now()); // Reset timer after refresh
      }
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(checkRefresh);
  }, [lastActivity, refetch]);

  if (loading) return <Loader />;
  if (error) return <div className="p-8 text-red-500">Error: {error.message}</div>;
  if (!product) return (
    <div className="p-8">
      <p>No product found</p>
      <p className="mt-2 text-sm opacity-60">Looking for: {props.id}</p>
      <p className="text-sm opacity-60">Type: {isNumericId ? 'ID' : 'Slug'}</p>
    </div>
  );

  return (
    <>
      {store?.isPremium && (
        <GameBackground image={undefined} />
      )}

      {/* Back Button */}
      <div className="mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-md transition hover:bg-white/20"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Home
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-10 md:grid-cols-8">
        <div className="md:col-span-2">
          <GameInfo item={product} />
        </div>
        {/* game info col ended */}
        <div className="md:col-span-6">
          <GameFormSimple item={product} slug={props.slug} />
        </div>
      </div>
    </>
  );
};

export default StoreProduct;
