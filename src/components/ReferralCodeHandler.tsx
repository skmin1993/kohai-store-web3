"use client";

import { useEffect, useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { useReferralCode } from '@/hooks/useReferralCode';

/**
 * Component that handles automatic application of referral codes from URL
 *
 * Flow:
 * 1. User visits: /signup?ref=MTNJGKZD
 * 2. Code is captured and stored in localStorage
 * 3. User connects wallet
 * 4. After authentication, code is automatically applied
 * 5. User sees success notification
 */
export default function ReferralCodeHandler() {
  const { isConnected, address } = useWallet();
  const { applyPendingReferralCode, hasPendingCode, getPendingCode } = useReferralCode();
  const [hasAttemptedApply, setHasAttemptedApply] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'success' | 'error'>('success');

  // Check if user is authenticated (has JWT token)
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasToken = !!window.localStorage.getItem('jwtToken');
      setIsAuthenticated(hasToken);
    }
  }, [isConnected, address]);

  // Apply pending referral code after wallet connection and authentication
  useEffect(() => {
    const applyCode = async () => {
      // Only apply once per session
      if (hasAttemptedApply) return;

      // Check if user is connected, authenticated, and has a pending code
      if (isConnected && isAuthenticated && hasPendingCode()) {
        const pendingCode = getPendingCode();
        console.log('🎯 Auto-applying referral code:', pendingCode);

        setHasAttemptedApply(true);

        // Wait a bit for the user data to load
        await new Promise(resolve => setTimeout(resolve, 1000));

        const result = await applyPendingReferralCode();

        if (result?.success) {
          setNotificationMessage(result.message || 'Referral code applied! You received a 10% discount voucher.');
          setNotificationType('success');
          setShowNotification(true);

          // Auto-hide after 5 seconds
          setTimeout(() => {
            setShowNotification(false);
          }, 5000);
        } else if (result?.success === false) {
          const errorMsg = result.message?.toLowerCase() || '';

          // Show error for "own referral code" - this is important to display
          if (errorMsg.includes('own referral') || errorMsg.includes('cannot use your own')) {
            setNotificationMessage('❌ You cannot use your own referral code. Please use a code from another user.');
            setNotificationType('error');
            setShowNotification(true);

            // Clear the pending code so user isn't stuck
            if (typeof window !== 'undefined') {
              localStorage.removeItem('pendingReferralCode');
            }

            // Auto-hide after 7 seconds (longer for important errors)
            setTimeout(() => {
              setShowNotification(false);
            }, 7000);
          }
          // Only show other errors if it's not "already used" error
          else if (!errorMsg.includes('already')) {
            setNotificationMessage(result.message || 'Failed to apply referral code.');
            setNotificationType('error');
            setShowNotification(true);

            // Auto-hide after 5 seconds
            setTimeout(() => {
              setShowNotification(false);
            }, 5000);
          }
        }
      }
    };

    applyCode();
  }, [isConnected, isAuthenticated, hasPendingCode, hasAttemptedApply, applyPendingReferralCode, getPendingCode]);

  // Reset attempt flag and clear pending code when user disconnects
  useEffect(() => {
    if (!isConnected) {
      setHasAttemptedApply(false);

      // Clear pending referral code on disconnect to prevent stale codes
      // This prevents old referral codes from showing errors on next login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('pendingReferralCode');
      }
    }
  }, [isConnected]);

  if (!showNotification) return null;

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] w-full max-w-md px-4 animate-fade-in">
      <div className={`rounded-lg backdrop-blur-md border p-4 shadow-2xl ${
        notificationType === 'success'
          ? 'bg-green-500/95 border-green-600'
          : 'bg-red-500/95 border-red-600'
      }`}>
        <div className="flex items-start gap-3">
          {notificationType === 'success' ? (
            <svg className="h-6 w-6 text-white flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="h-6 w-6 text-white flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          )}
          <div className="flex-1">
            <h3 className="font-bold text-white mb-1">
              {notificationType === 'success' ? '🎉 Referral Code Applied!' : '❌ Error'}
            </h3>
            <p className="text-sm text-white/90">{notificationMessage}</p>
          </div>
          <button
            onClick={() => setShowNotification(false)}
            className="text-white/70 hover:text-white transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
