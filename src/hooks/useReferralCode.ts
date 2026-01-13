import { useState } from 'react';
import { useApplyReferralCodeMutation } from 'graphql/generated/graphql';

const REFERRAL_CODE_KEY = 'pendingReferralCode';

export function useReferralCode() {
  const [applyReferralCode] = useApplyReferralCodeMutation();
  const [isApplying, setIsApplying] = useState(false);

  // NOTE: We no longer auto-store referral codes from URL
  // The referral confirmation page handles storing after user confirms

  // Function to apply the pending referral code (call after wallet connection)
  const applyPendingReferralCode = async () => {
    if (typeof window === 'undefined') return null;

    const pendingCode = localStorage.getItem(REFERRAL_CODE_KEY);

    if (!pendingCode) {
      console.log('ℹ️ No pending referral code to apply');
      return null;
    }

    console.log('🔄 Applying pending referral code:', pendingCode);
    setIsApplying(true);

    try {
      const result = await applyReferralCode({
        variables: { code: pendingCode }
      });

      if (result.data?.applyReferralCode?.errors && result.data.applyReferralCode.errors.length > 0) {
        const errorMessage = result.data.applyReferralCode.errors.join(', ');

        // Don't log "already used" error as it's expected behavior
        if (!errorMessage.toLowerCase().includes('already used')) {
          console.error('❌ Failed to apply referral code:', result.data.applyReferralCode.errors);
        }

        setIsApplying(false);
        return {
          success: false,
          message: errorMessage
        };
      }

      if (result.data?.applyReferralCode?.message) {
        console.log('✅ Referral code applied successfully:', result.data.applyReferralCode.message);

        // Remove from localStorage after successful application
        localStorage.removeItem(REFERRAL_CODE_KEY);

        setIsApplying(false);
        return {
          success: true,
          message: result.data.applyReferralCode.message,
          voucher: result.data.applyReferralCode.voucher
        };
      }

      setIsApplying(false);
      return null;
    } catch (error) {
      console.error('❌ Error applying referral code:', error);
      setIsApplying(false);

      // Clear the pending code on critical errors to prevent retry loops
      localStorage.removeItem(REFERRAL_CODE_KEY);

      // Don't return error message - network/auth errors shouldn't show as referral errors
      // This prevents confusing error messages when the issue is authentication, not the referral code
      return null;
    }
  };

  // Function to check if there's a pending code
  const hasPendingCode = () => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem(REFERRAL_CODE_KEY);
  };

  // Function to get the pending code
  const getPendingCode = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFERRAL_CODE_KEY);
  };

  // Function to clear pending code
  const clearPendingCode = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(REFERRAL_CODE_KEY);
  };

  return {
    applyPendingReferralCode,
    hasPendingCode,
    getPendingCode,
    clearPendingCode,
    isApplying
  };
}
