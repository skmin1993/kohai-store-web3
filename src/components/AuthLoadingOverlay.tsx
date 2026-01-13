"use client";

import { useWallet } from "@/contexts/WalletContext";
import Loader from "./common/Loader";

/**
 * AuthLoadingOverlay
 * Shows a full-screen loading spinner when user data is being fetched after wallet connection.
 * Prevents user interaction until email verification status is confirmed.
 */
export default function AuthLoadingOverlay() {
  const { isLoadingUserData, isConnected } = useWallet();

  // Only show loader if connected and loading user data
  if (!isConnected || !isLoadingUserData) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
      }}
    >
      <div className="h-16 w-16 animate-spin rounded-full border-4 border-solid border-primary border-t-transparent"></div>
      <p style={{ color: "#fff", fontSize: "16px", fontWeight: 500 }}>
        Loading your account...
      </p>
    </div>
  );
}
