"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";

/**
 * Mobile Bottom Navigation Bar
 * Shows on mobile devices only (hidden on md and above)
 */
export default function MobileBottomNav() {
  const pathname = usePathname();
  const { isConnected, openModal } = useWallet();

  const isActive = (path: string) => pathname === path;

  const handleProfileClick = () => {
    // Open wallet modal for profile/account access
    openModal();
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/95 backdrop-blur-md md:hidden">
      <div className="flex items-center justify-around py-2">
        {/* Home */}
        <Link
          href="/"
          className={`flex flex-col items-center gap-1 px-4 py-2 text-xs transition ${
            isActive("/") ? "text-purple-400" : "text-gray-400 hover:text-white"
          }`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span>Home</span>
        </Link>

        {/* Staking */}
        <Link
          href="/staking"
          className={`flex flex-col items-center gap-1 px-4 py-2 text-xs transition ${
            isActive("/staking") ? "text-purple-400" : "text-gray-400 hover:text-white"
          }`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Stake</span>
        </Link>

        {/* Swap */}
        <Link
          href="/swap"
          className={`flex flex-col items-center gap-1 px-4 py-2 text-xs transition ${
            isActive("/swap") ? "text-purple-400" : "text-gray-400 hover:text-white"
          }`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <span>Swap</span>
        </Link>

        {/* Account - Opens wallet modal */}
        <button
          onClick={handleProfileClick}
          className={`flex flex-col items-center gap-1 px-4 py-2 text-xs transition ${
            isConnected ? "text-green-400" : "text-gray-400 hover:text-white"
          }`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>{isConnected ? "Account" : "Connect"}</span>
        </button>
      </div>
    </nav>
  );
}
