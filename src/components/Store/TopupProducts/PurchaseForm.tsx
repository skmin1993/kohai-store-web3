"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useCreateOrderMutation, useAuthenticateWalletMutation, useCurrentUserQuery, useCreateGameAccountMutation, useMyGameAccountsQuery, useDeleteGameAccountMutation, useValidateGameAccountMutation, TopupProductItemFragment, useGetActiveVouchersQuery } from "graphql/generated/graphql";
import { useWallet } from "@/contexts/WalletContext";
import { useCurrency } from "@/components/Store/CurrencySelector";
import dynamic from "next/dynamic";

const EmailVerificationModal = dynamic(() => import("@/components/Store/EmailVerification/EmailVerificationModal"), {
  ssr: false,
});

// Meld minimum amounts for different currencies (equivalent to ~$11 USD)
const MINIMUM_AMOUNTS: Record<string, number> = {
  'MYR': 51,    // 50.73 MYR
  'SGD': 15,    // ~$11 USD
  'USD': 11,    // $11 USD
  'IDR': 175000, // ~$11 USD
  'PHP': 625,   // ~$11 USD
  'THB': 370,   // ~$11 USD
  'VND': 280000, // ~$11 USD
};

interface PurchaseFormProps {
  productItem: TopupProductItemFragment;
  userInput?: any; // JSON schema from product
  onChangeProduct?: () => void; // Callback to change product selection
  onGameAccountFilled?: (filled: boolean) => void; // Callback when game account info is filled
}

const PurchaseForm = ({ productItem, userInput, onChangeProduct, onGameAccountFilled }: PurchaseFormProps) => {
  const [createOrder, { error }] = useCreateOrderMutation();
  const [authenticateWallet] = useAuthenticateWalletMutation();
  const [createGameAccount] = useCreateGameAccountMutation();
  const [deleteGameAccount] = useDeleteGameAccountMutation();
  const [validateGameAccount] = useValidateGameAccountMutation();
  const { isConnected, address, sendTransaction, connect, getBalance } = useWallet();
  const { selectedCurrency, convertPrice, formatPrice } = useCurrency();

  const { data: currentUserData, refetch: refetchUser } = useCurrentUserQuery({
    skip: !isConnected,
    fetchPolicy: 'cache-and-network', // Use cache first, but fetch fresh data
    notifyOnNetworkStatusChange: true,
  });

  // Get user's tier discount
  const user = currentUserData?.currentUser;
  // Tier discount fallback - MATCH BACKEND CONFIG
  const getTierDiscount = (tierName: string | null | undefined): number => {
    if (!tierName) return 0;
    const lowerTier = tierName.toLowerCase();
    if (lowerTier === "elite") return 1;
    if (lowerTier === "grandmaster") return 2;
    if (lowerTier === "legend") return 3;
    return 0;
  };

  // Always use backend discountPercent if provided (>= 0), otherwise fallback to tier name
  const userDiscountPercent = (user?.discountPercent !== undefined && user?.discountPercent !== null && user.discountPercent >= 0)
    ? user.discountPercent
    : getTierDiscount(user?.tierName);

  const [orderResult, setOrderResult] = useState<any>(null);
  const [userData, setUserData] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [waitingForWalletAuth, setWaitingForWalletAuth] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedGameAccountId, setSelectedGameAccountId] = useState<string | null>(null);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [validationMessage, setValidationMessage] = useState<string>('');
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [verifiedIGN, setVerifiedIGN] = useState<string | null>(null);
  const [tempAccountIdForVerify, setTempAccountIdForVerify] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState<{
    ign: string | null;
    gameId: string;
    amount: number;
    productName: string;
    isDemo?: boolean;
  } | null>(null);
  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);
  const [usdtBalance, setUsdtBalance] = useState<number | null>(null);
  const [loadingUsdtBalance, setLoadingUsdtBalance] = useState(false);

  // Product selection confirmation (for compact view)
  const [productConfirmed, setProductConfirmed] = useState(false);

  // Saved account selection confirmation (for hiding the list)
  const [accountSectionCollapsed, setAccountSectionCollapsed] = useState(false);

  // FPX/Meld confirmation modal states
  const [showFPXConfirmModal, setShowFPXConfirmModal] = useState(false);
  const [fpxConfirmData, setFpxConfirmData] = useState<{
    topupAmountUsd: number;
    topupAmount: number;
    currencyCode: string;
    currencySymbol: string;
    productPrice: number;
    remainingBalance: number;
    meldUrl: string;
  } | null>(null);

  // Insufficient balance alert modal
  const [showInsufficientBalanceModal, setShowInsufficientBalanceModal] = useState(false);
  const [insufficientBalanceData, setInsufficientBalanceData] = useState<{
    currentBalance: number;
    requiredAmount: number;
    shortfall: number;
  } | null>(null);

  // Check if user is authenticated (has JWT token)
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasToken = !!window.localStorage.getItem('jwtToken');
      setIsAuthenticated(hasToken);
    }
  }, [isConnected, address]);

  // Clear FPX modal data when currency changes to force recalculation
  useEffect(() => {
    if (showFPXConfirmModal) {
      setShowFPXConfirmModal(false);
      setFpxConfirmData(null);
    }
  }, [selectedCurrency.code]);

  // Auto-confirm product when first selected (compact view by default)
  useEffect(() => {
    setProductConfirmed(true);
  }, [productItem.id]); // When product changes, auto-confirm it

  // Restore cached userData from sessionStorage on mount
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && productItem.topupProductId && !hasRestoredRef.current) {
      const cacheKey = `tempUserData_${productItem.topupProductId}`;
      const cachedData = sessionStorage.getItem(cacheKey);

      if (cachedData) {
        try {
          const parsedData = JSON.parse(cachedData);
          // Only restore if userData is empty and we have cached data
          if (Object.keys(userData).length === 0 && Object.keys(parsedData).length > 0) {
            setUserData(parsedData);
            hasRestoredRef.current = true;
            console.log('✅ Restored cached user data from sessionStorage:', parsedData);
          }
        } catch (error) {
          console.error('Error parsing cached user data:', error);
          sessionStorage.removeItem(cacheKey);
        }
      }
    }
  }, [productItem.topupProductId, userData]); // Only run on mount or when product changes

  // Notify parent when game account info is filled
  useEffect(() => {
    if (onGameAccountFilled) {
      // Check if userData has any required fields filled
      const hasRequiredFields = Object.keys(userData).length > 0 &&
        Object.values(userData).some(value => value && String(value).trim() !== '');
      onGameAccountFilled(hasRequiredFields);
    }
  }, [userData, onGameAccountFilled]);

  // Fetch user's active vouchers
  const { data: vouchersData } = useGetActiveVouchersQuery({
    skip: !isConnected || !isAuthenticated,
    fetchPolicy: 'cache-and-network',
  });

  const activeVouchers = vouchersData?.activeVouchers || [];
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);

  // Fetch ALL saved game accounts for the user (not filtered by product)
  const { data: gameAccountsData, refetch: refetchGameAccounts, loading: loadingGameAccounts } = useMyGameAccountsQuery({
    variables: {
      topupProductId: undefined, // Fetch all game accounts, not filtered by product
      approvedOnly: false,
    },
    skip: !isConnected || !isAuthenticated, // Skip if not connected OR not authenticated
    fetchPolicy: 'cache-and-network',
  });

  // Filter game accounts for this product - Memoized
  const filteredGameAccounts = useMemo(() => {
    const allAccounts = gameAccountsData?.myGameAccounts || [];
    const productId = productItem.topupProductId?.toString();

    if (!productId || allAccounts.length === 0) {
      return [];
    }

    // Only return accounts that match THIS specific product AND are active
    const matchingAccounts = allAccounts.filter(acc =>
      acc.topupProduct?.id === productId && acc.status === 'active'
    );

    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Filtering accounts:', {
        currentProductId: productId,
        totalAccounts: allAccounts.length,
        matchingAccounts: matchingAccounts.length,
        disabledCount: allAccounts.filter(acc => acc.status === 'disabled').length,
        allAccountsProductIds: allAccounts.map(acc => acc.topupProduct?.id),
      });
    }

    return matchingAccounts;
  }, [gameAccountsData, productItem.topupProductId]);

  // Debug game accounts loading
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🎮 Game Accounts Status:', {
        isConnected,
        productId: productItem.topupProductId,
        loading: loadingGameAccounts,
        totalAccounts: gameAccountsData?.myGameAccounts?.length || 0,
        filteredAccounts: filteredGameAccounts.length,
        accounts: filteredGameAccounts.map(acc => ({
          id: acc.id,
          accountId: acc.accountId,
          displayName: acc.displayName,
          serverId: acc.serverId,
          productId: acc.topupProduct?.id
        }))
      });
    }
  }, [gameAccountsData, loadingGameAccounts, isConnected, productItem.topupProductId, filteredGameAccounts]);

  // Parse user input fields from product's user_input JSONB field - Memoized for performance
  const userInputFields = useMemo(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('=== Parsing userInput ===');
      console.log('Raw userInput:', JSON.stringify(userInput, null, 2));
      console.log('Type of userInput:', typeof userInput);
      console.log('Is Array?', Array.isArray(userInput));
    }

    if (!userInput) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ No userInput provided');
      }
      return [];
    }

    // If userInput is an array
    if (Array.isArray(userInput)) {
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ userInput is array:', userInput);
      }

      const validFields = userInput.map((field, index) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Field ${index}:`, field, 'Type:', typeof field);
        }

        // Check if field is a simple string (e.g., ["Player ID", "Server"])
        if (typeof field === 'string') {
          if (process.env.NODE_ENV === 'development') {
            console.log(`Converting string "${field}" to field object`);
          }
          // Keep the original field name as-is (preserve case and spaces)
          return {
            tag: 'input',         // Default to input for strings
            name: field,          // Keep as "Player ID", "YE" etc.
            label: field,         // Same as name
            type: 'text',
            required: true,
            placeholder: `Enter ${field}`,
            options: null,
            description: '',
          };
        }

        // Check if field is an object with properties
        if (typeof field === 'object' && field !== null) {
          return {
            tag: 'input',
            name: field.name || field.key || `field_${index}`,
            label: field.label || field.name || field.key || `Field ${index}`,
            type: field.type || 'text',
            required: field.required !== false,
            placeholder: field.placeholder || `Enter ${field.label || field.name || field.key || 'value'}`,
            options: null,
            description: field.description || '',
          };
        }

        // Fallback for unknown format
        return {
          tag: 'input',
          name: `field_${index}`,
          label: `Field ${index}`,
          type: 'text',
          required: true,
          placeholder: 'Enter value',
          options: null,
          description: '',
        };
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('Processed fields:', validFields);
      }
      return validFields;
    }

    // If userInput is an object with a fields property
    if (typeof userInput === 'object' && userInput.fields && Array.isArray(userInput.fields)) {
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ userInput has fields property:', userInput.fields);
      }

      // Parse the new structure with tag and attrs
      const parsedFields = userInput.fields.map((field: any, index: number) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Parsing field ${index}:`, field);
        }

        // Check if field has tag and attrs properties (new structure)
        if (field.tag && field.attrs) {
          const { tag, attrs } = field;
          if (process.env.NODE_ENV === 'development') {
            console.log(`Field ${index} - tag: ${tag}, attrs:`, attrs);
          }

          return {
            tag: tag,                                    // "input" or "dropdown"
            name: attrs.key || attrs.name || `field_${index}`,  // Use attrs.key as storage key (e.g., "Select Server")
            label: attrs.key || attrs.name || `Field ${index}`, // Use attrs.key as label
            type: attrs.type || 'text',
            required: true,
            placeholder: attrs.placeholder || `Enter ${attrs.key || 'value'}`,
            options: attrs.datas || null,                // Dropdown options
            description: '',
          };
        }

        // Fallback to old structure (for backwards compatibility)
        return {
          tag: 'input',
          name: field.name || field.key || `field_${index}`,
          label: field.label || field.name || field.key || `Field ${index}`,
          type: field.type || 'text',
          required: field.required !== false,
          placeholder: field.placeholder || `Enter ${field.label || field.name || 'value'}`,
          options: null,
          description: field.description || '',
        };
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('Parsed fields with tag/attrs:', parsedFields);
      }
      return parsedFields;
    }

    // If userInput is an object, try to convert to array
    if (typeof userInput === 'object') {
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ userInput is object, converting to array');
      }
      const entries = Object.entries(userInput);
      if (process.env.NODE_ENV === 'development') {
        console.log('Object entries:', entries);
      }

      return entries.map(([key, value]: [string, any]) => {
        // Check if value is an array (dropdown options)
        if (Array.isArray(value)) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`Field "${key}" is dropdown with options:`, value);
          }
          return {
            tag: 'dropdown',
            name: key,                                    // Use key as storage field name
            label: key,                                   // Use key as label
            type: 'string',
            required: true,
            placeholder: `Select ${key}`,
            options: value.map((opt: string) => ({       // Convert array to options
              text: opt,
              value: opt
            })),
            description: '',
          };
        }

        // If value is "string" or any other string value (text input)
        if (typeof value === 'string' && value.toLowerCase() === 'string') {
          if (process.env.NODE_ENV === 'development') {
            console.log(`Field "${key}" is text input`);
          }
          return {
            tag: 'input',
            name: key,
            label: key,
            type: 'text',
            required: true,
            placeholder: `Enter ${key}`,
            options: null,
            description: '',
          };
        }

        // Fallback for old structure with label/type properties
        return {
          tag: 'input',
          name: key,
          label: value?.label || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          type: value?.type || 'text',
          required: value?.required !== false,
          placeholder: value?.placeholder || `Enter ${key.replace(/_/g, ' ')}`,
          options: null,
          description: value?.description || '',
        };
      });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('❌ userInput format not recognized');
    }
    return [];
  }, [userInput]); // Memoize based on userInput changes only

  // Fetch USDT balance when wallet changes
  useEffect(() => {
    const fetchUsdtBalance = async () => {
      if (!isConnected || !address) {
        setUsdtBalance(null);
        return;
      }

      setLoadingUsdtBalance(true);
      try {
        console.log('🔍 PurchaseForm fetching USDT balance for address:', address);
        const balance = await getBalance('USDT');
        setUsdtBalance(balance);
        console.log('✅ PurchaseForm USDT balance:', balance, 'for address:', address);
      } catch (error) {
        console.error('Error fetching USDT balance:', error);
        setUsdtBalance(null);
      } finally {
        setLoadingUsdtBalance(false);
      }
    };

    fetchUsdtBalance();

    // Refresh balance every 10 seconds
    const balanceInterval = setInterval(fetchUsdtBalance, 10000);
    return () => clearInterval(balanceInterval);
  }, [isConnected, address, getBalance]);

  // No need to fetch SOL price - we only use USDT (1:1 with USD)

  // Listen for wallet switch event to refetch user data
  useEffect(() => {
    const handleWalletSwitch = async (event: any) => {
      console.log('🔄 Wallet switched in PurchaseForm - refetching user data');
      console.log('Previous:', event.detail.previousAddress);
      console.log('New:', event.detail.newAddress);

      // Clear any form errors and processing state
      setFormErrors([]);
      setProcessingPayment(false);

      // Optimized: Poll for JWT token instead of fixed delay
      console.log('Waiting for backend authentication...');
      let attempts = 0;
      const maxAttempts = 20; // 2 seconds max

      while (attempts < maxAttempts) {
        const jwtToken = window.localStorage.getItem('jwtToken');
        if (jwtToken) {
          console.log('✅ JWT token found in PurchaseForm');
          setIsAuthenticated(true); // Update authentication state
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      // Small delay after auth
      await new Promise(resolve => setTimeout(resolve, 200));

      // Refetch user data for new wallet
      console.log('Refetching user data from network...');
      try {
        await refetchUser();
        console.log('✅ User data refetched in PurchaseForm');
        
        // Also refetch game accounts after authentication
        if (isAuthenticated) {
          await refetchGameAccounts();
          console.log('✅ Game accounts refetched');
        }
      } catch (error) {
        console.error('❌ Error refetching user data in PurchaseForm:', error);
      }
    };

    window.addEventListener('wallet-switched', handleWalletSwitch);
    return () => window.removeEventListener('wallet-switched', handleWalletSwitch);
  }, [refetchUser]);

  // Get product's original currency from database (e.g., MYR, USD, SGD)
  const originalCurrency = useMemo(() => {
    const curr = (productItem.currency && typeof productItem.currency === 'string')
      ? productItem.currency.toUpperCase()
      : 'USD'; // Default to USD if not specified (USDT products are typically in USD)
    
    console.log('🏷️ Product Currency Info:', {
      productId: productItem.id,
      productName: productItem.displayName,
      price: productItem.price,
      currency: curr,
      currencyFromDB: productItem.currency
    });
    
    return curr;
  }, [productItem.currency, productItem.id, productItem.displayName, productItem.price]);

  // Convert product price from original currency to USD for USDT payment
  // USDT is 1:1 with USD, so we need USD amount
  const productPriceUsd = useMemo(() => {
    const priceValue = productItem.price || 0;
    
    // If already in USD, no conversion needed
    if (originalCurrency === 'USD') {
      console.log('💱 Price already in USD:', {
        price: priceValue,
        currency: originalCurrency,
        willSendToBackend: priceValue
      });
      return priceValue;
    }
    
    // Convert from original currency (e.g., MYR) to USD
    const converted = convertPrice(priceValue, originalCurrency, 'USD');
    const usdPrice = converted || priceValue;
    
    console.log('💱 Currency Conversion for Payment:', {
      originalPrice: priceValue,
      originalCurrency: originalCurrency,
      convertedToUSD: usdPrice,
      conversionWorked: converted !== null,
      conversionRate: converted ? (usdPrice / priceValue).toFixed(6) : 'FAILED - Using raw price',
      explanation: converted 
        ? `${priceValue} ${originalCurrency} ÷ exchange_rate = ${usdPrice} USD`
        : `CONVERSION FAILED - using raw price ${priceValue}`
    });
    
    return usdPrice;
  }, [productItem.price, originalCurrency, convertPrice]);

  // Convert price to selected display currency
  const convertedPrice = useMemo(() => {
    if (selectedCurrency.code === 'USD') {
      return productPriceUsd;
    }
    const converted = convertPrice(productPriceUsd, 'USD', selectedCurrency.code);
    return converted || productPriceUsd;
  }, [productPriceUsd, selectedCurrency.code, convertPrice]);

  // Get selected voucher details
  const selectedVoucher = selectedVoucherId
    ? activeVouchers.find((v: any) => v.id === selectedVoucherId)
    : null;

  // Calculate discount - user CHOOSES between voucher OR tier discount
  // If voucher is selected → use voucher discount
  // If no voucher selected → use tier discount
  const voucherDiscountPercent = selectedVoucher?.discountPercent || 0;
  const totalDiscountPercent = selectedVoucherId ? voucherDiscountPercent : userDiscountPercent;

  // Which discount is being applied
  const isUsingVoucher = selectedVoucherId && voucherDiscountPercent > 0;
  const isUsingTierDiscount = !selectedVoucherId && userDiscountPercent > 0;

  // Debug logging
  if (typeof window !== 'undefined') {
    console.log('=== DISCOUNT DEBUG ===');
    console.log('selectedVoucherId:', selectedVoucherId);
    console.log('voucherDiscountPercent:', voucherDiscountPercent);
    console.log('userDiscountPercent (tier):', userDiscountPercent);
    console.log('totalDiscountPercent (final):', totalDiscountPercent);
    console.log('isUsingVoucher:', isUsingVoucher);
    console.log('isUsingTierDiscount:', isUsingTierDiscount);
  }

  // Calculate discounted prices
  const discountAmount = (convertedPrice * totalDiscountPercent) / 100;
  const discountedPrice = convertedPrice - discountAmount;
  const discountedPriceUsd = productPriceUsd - ((productPriceUsd * totalDiscountPercent) / 100);
  const hasDiscount = totalDiscountPercent > 0;

  // Check if account exists in saved accounts (no auto-save)
  const checkAccountExists = useCallback(async (data: Record<string, string>) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 checkAccountExists called with data:', data);
    }

    // Only validate if user is connected
    if (!isConnected) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ Not connected, skipping check');
      }
      setValidationStatus('idle');
      setValidationMessage('');
      return;
    }

    // Check if we have enough data to validate
    const accountId = data["User ID"] || data["Player ID"] || data["UID"] || data["Account ID"];
    const serverId = data["insert server value"] || data["Server"] || data["Region"];

    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Extracted from userData:', {
        accountId,
        serverId,
        allDataKeys: Object.keys(data),
        allDataValues: data
      });
    }

    if (!accountId || accountId.length < 3) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ Account ID too short or missing:', accountId);
      }
      setValidationStatus('idle');
      setValidationMessage('');
      return;
    }

    // Check if this account already exists in saved accounts
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Before checking - All filtered accounts:', {
        accountIdToFind: accountId,
        accountIdType: typeof accountId,
        serverIdToFind: serverId,
        serverIdType: typeof serverId,
        filteredAccounts: filteredGameAccounts.map(acc => ({
          id: acc.id,
          accountId: acc.accountId,
          accountIdType: typeof acc.accountId,
          serverId: acc.serverId,
          serverIdType: typeof acc.serverId,
          matches: acc.accountId === accountId,
          serverMatches: !serverId || acc.serverId === serverId
        }))
      });
    }

    const existingAccount = filteredGameAccounts.find(acc => {
      const accountIdMatch = acc.accountId === accountId;
      const serverIdMatch = !serverId || acc.serverId === serverId;

      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 Checking account ${acc.accountId}:`, {
          accountIdMatch,
          serverIdMatch,
          bothMatch: accountIdMatch && serverIdMatch
        });
      }

      return accountIdMatch && serverIdMatch;
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Account search result:', {
        accountId,
        serverId,
        filteredGameAccountsCount: filteredGameAccounts.length,
        existingAccount: existingAccount ? {
          id: existingAccount.id,
          accountId: existingAccount.accountId,
          serverId: existingAccount.serverId,
          approve: existingAccount.approve
        } : null,
      });
    }

    if (existingAccount) {
      setSelectedGameAccountId(existingAccount.id);
      if (existingAccount.approve) {
        setValidationStatus('valid');
        setValidationMessage('✓ Verified account found');
      } else {
        setValidationStatus('valid');
        setValidationMessage('Account saved (pending verification)');
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Account found - setting validationStatus to valid');
      }
    } else {
      // Account not found - ready to save
      setValidationStatus('idle');
      setValidationMessage('');

      if (process.env.NODE_ENV === 'development') {
        console.log('❌ Account not found - validationStatus set to idle (button should show)');
      }
    }
  }, [isConnected, filteredGameAccounts]);

  // Trigger validation when userData is restored from cache
  useEffect(() => {
    if (hasRestoredRef.current && Object.keys(userData).length > 0 && isConnected) {
      const accountId = userData["User ID"] || userData["Player ID"] || userData["UID"] || userData["Account ID"];
      if (accountId && accountId.length >= 3) {
        console.log('🔄 Triggering validation for restored data');
        // Small delay to ensure filteredGameAccounts is loaded
        setTimeout(() => {
          checkAccountExists(userData);
          hasRestoredRef.current = false;
        }, 500);
      }
    }
  }, [userData, isConnected, checkAccountExists]);

  // Optional manual verification (for users who want to verify and save IGN)
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerifyAccount = useCallback(async () => {
    const accountId = userData["User ID"] || userData["Player ID"] || userData["UID"] || userData["Account ID"];
    const serverId = userData["insert server value"] || userData["Server"] || userData["Region"];

    if (!accountId) {
      return;
    }

    if (!productItem.topupProductId) {
      return;
    }

    setIsVerifying(true);

    // Run verification in background (fire-and-forget)
    (async () => {
      try {
        // Create account for verification
        console.log('🔍 Creating account for verification (background)...');
        const createResult = await createGameAccount({
          variables: {
            topupProductId: parseInt(productItem.topupProductId.toString()),
            accountId: accountId,
            serverId: serverId || undefined,
            inGameName: undefined,
            userData: userData,
          },
        });

        if (createResult.data?.createGameAccount?.gameAccount) {
          const tempAccount = createResult.data.createGameAccount.gameAccount;
          setTempAccountIdForVerify(tempAccount.id);

          // Validate with vendor to get IGN
          console.log('🔍 Validating with game vendor (background)...');
          const validateResult = await validateGameAccount({
            variables: {
              gameAccountId: parseInt(tempAccount.id),
            },
          });

          if (validateResult.data?.validateGameAccountMutation?.gameAccount) {
            const ign = validateResult.data.validateGameAccountMutation.gameAccount.inGameName;
            setVerifiedIGN(ign || null);
            console.log('✅ IGN verified (background):', ign);

            // Refresh saved accounts list
            refetchGameAccounts();
          } else {
            console.log('⚠️ Could not retrieve IGN (background)');
          }
        }
      } catch (err: any) {
        console.error('❌ Verification error (background):', err);
      } finally {
        setIsVerifying(false);
      }
    })();
  }, [userData, productItem.topupProductId, createGameAccount, validateGameAccount, refetchGameAccounts]);

  // Promise-based confirmation modal
  const showConfirmation = useCallback((data: {
    ign: string | null;
    gameId: string;
    amount: number;
    productName: string;
    isDemo?: boolean;
  }): Promise<boolean> => {
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmModalData(data);
      setShowConfirmModal(true);
    });
  }, []);

  // Handle modal confirmation
  const handleConfirm = useCallback(() => {
    if (confirmResolveRef.current) {
      confirmResolveRef.current(true);
      confirmResolveRef.current = null;
    }
    setShowConfirmModal(false);
  }, []);

  // Handle modal cancel
  const handleCancel = useCallback(() => {
    if (confirmResolveRef.current) {
      confirmResolveRef.current(false);
      confirmResolveRef.current = null;
    }
    setShowConfirmModal(false);
  }, []);

  // Optimize handleInputChange with useCallback and add validation check
  const handleInputChange = useCallback((fieldName: string, value: string) => {
    setUserData((prev) => {
      const newData = {
        ...prev,
        [fieldName]: value,
      };

      if (process.env.NODE_ENV === 'development') {
        console.log('📝 Input changed:', {
          fieldName,
          value,
          newData
        });
      }

      // Immediately cache userData to sessionStorage for this product
      if (typeof window !== 'undefined') {
        const cacheKey = `tempUserData_${productItem.topupProductId}`;
        if (Object.keys(newData).length > 0 && Object.values(newData).some(v => v.trim())) {
          sessionStorage.setItem(cacheKey, JSON.stringify(newData));
          console.log('💾 Cached user data to sessionStorage:', cacheKey);
        } else {
          // Clear cache if all fields are empty
          sessionStorage.removeItem(cacheKey);
        }
      }

      // Clear previous validation timeout
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }

      // Reset validation status when user types
      setValidationStatus('idle');
      setValidationMessage('');

      // Clear verified IGN when user changes Player ID or Server
      const isAccountIdField = fieldName === "User ID" || fieldName === "Player ID" || fieldName === "UID" || fieldName === "Account ID";
      const isServerField = fieldName === "insert server value" || fieldName === "Server" || fieldName === "Region";

      if (isAccountIdField || isServerField) {
        setVerifiedIGN(null);
        setTempAccountIdForVerify(null);
        console.log('🔄 Cleared verification state - user is changing account details');
      }

      // Check if account exists after 1 second of inactivity
      if (value.trim()) {
        validationTimeoutRef.current = setTimeout(() => {
          if (process.env.NODE_ENV === 'development') {
            console.log('⏱️ Timeout triggered - checking account exists');
          }
          checkAccountExists(newData);
        }, 1000);
      }

      return newData;
    });
  }, [checkAccountExists, productItem.topupProductId]);

  // Load saved game account into form
  const handleLoadGameAccount = useCallback((accountId: string) => {
    const account = filteredGameAccounts.find(acc => acc.id === accountId);
    if (account?.userData) {
      setUserData(account.userData as Record<string, string>);
      setSelectedGameAccountId(accountId);
      setTempAccountIdForVerify(null); // Clear temp account

      // Clear cached user data when loading a saved account
      if (typeof window !== 'undefined') {
        const cacheKey = `tempUserData_${productItem.topupProductId}`;
        sessionStorage.removeItem(cacheKey);
        console.log('🧹 Cleared cached user data - loaded saved account');
      }

      // For saved accounts, set verified IGN
      if (account.inGameName) {
        setVerifiedIGN(account.inGameName);
        console.log('✅ Loaded saved account with IGN:', account.inGameName);
      } else {
        // Clear IGN if account doesn't have one
        setVerifiedIGN(null);
        console.log('⚠️ Loaded saved account without IGN');
      }

      // Set validation status for loaded account
      if (account.approve) {
        setValidationStatus('valid');
        setValidationMessage('✓ Verified account');
      } else {
        setValidationStatus('valid');
        setValidationMessage('Account loaded (pending verification)');
      }

      // Collapse the saved accounts section after selection
      setAccountSectionCollapsed(true);

      console.log('✅ Loaded saved game account:', accountId);
    }
  }, [filteredGameAccounts, productItem.topupProductId]);

  // Cleanup validation timeout on unmount
  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, []);

  // Delete (disable) game account
  const handleDeleteGameAccount = useCallback(async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this saved game account?')) {
      return;
    }

    try {
      const result = await deleteGameAccount({
        variables: {
          gameAccountId: parseInt(accountId),
        },
      });

      if (result.data?.deleteGameAccount?.success) {
        console.log('✅ Game account deleted');
        // Clear form if deleted account was selected
        if (selectedGameAccountId === accountId) {
          setUserData({});
          setSelectedGameAccountId(null);
          setValidationStatus('idle');
          setValidationMessage('');
          setVerifiedIGN(null);
          setTempAccountIdForVerify(null);
          // Clear cached user data from sessionStorage
          if (typeof window !== 'undefined') {
            const cacheKey = `tempUserData_${productItem.topupProductId}`;
            sessionStorage.removeItem(cacheKey);
            console.log('🧹 Cleared cached user data after account deletion');
          }
        }
        // Refetch to update the list
        refetchGameAccounts();
      } else if (result.data?.deleteGameAccount?.errors) {
        alert('Failed to delete: ' + result.data.deleteGameAccount.errors.join(', '));
      }
    } catch (err: any) {
      console.error('Error deleting game account:', err);
      alert('Error deleting account: ' + err.message);
    }
  }, [deleteGameAccount, selectedGameAccountId, refetchGameAccounts]);

  // Optimize handleWalletPayment with useCallback
  const handleWalletPayment = useCallback(async () => {
    if (!isConnected || !address) {
      connect();
      return;
    }

    setProcessingPayment(true);
    setFormErrors([]);

    try {
      // STEP 1: Check email verification
      const user = currentUserData?.currentUser;
      if (!user?.email) {
        setFormErrors(['Please add your email address before making a payment.']);
        setProcessingPayment(false);
        setShowEmailModal(true);
        return;
      }

      if (!user?.emailVerified) {
        setFormErrors(['Please verify your email before making a payment.']);
        setProcessingPayment(false);
        setShowEmailModal(true);
        return;
      }

      // STEP 2: Validate user input fields BEFORE payment
      const missingFields = userInputFields
        .filter((field: any) => field.required && !userData[field.name]?.trim())
        .map((field: any) => field.label || field.name);

      if (missingFields.length > 0) {
        setFormErrors([`Please fill in required fields: ${missingFields.join(", ")}`]);
        setProcessingPayment(false);
        return;
      }

      // STEP 2.5: Check USDT balance before proceeding
      const paymentAmount = discountedPriceUsd < 0.01
        ? parseFloat(discountedPriceUsd.toFixed(6))
        : parseFloat(discountedPriceUsd.toFixed(2));

      if (usdtBalance !== null && usdtBalance < paymentAmount) {
        // Show insufficient balance modal
        setInsufficientBalanceData({
          currentBalance: usdtBalance,
          requiredAmount: paymentAmount,
          shortfall: paymentAmount - usdtBalance
        });
        setShowInsufficientBalanceModal(true);
        setProcessingPayment(false);
        return;
      }

      // STEP 3: Calculate USDT payment amount (1:1 with USD)
      // For very small amounts (< 0.01), use 6 decimal places
      // For normal amounts, use 2 decimal places
      // Use discounted price if user has a tier discount

      console.log('💰 Payment Debug:', {
        productItemPrice: productItem.price,
        productPriceUsd: productPriceUsd,
        discountedPriceUsd: discountedPriceUsd,
        userDiscountPercent: userDiscountPercent,
        paymentAmount: paymentAmount,
        paymentAmountFormatted: paymentAmount < 0.01
          ? paymentAmount.toFixed(6)
          : paymentAmount.toFixed(2),
        productItem: productItem
      });

      // STEP 5: Check if merchant wallet is configured
      const merchantAddress = process.env.NEXT_PUBLIC_MERCHANT_WALLET;

      if (!merchantAddress || merchantAddress === 'YOUR_WALLET_ADDRESS_HERE' || merchantAddress === '') {
        setFormErrors([
          'Merchant wallet not configured.',
          'Please add NEXT_PUBLIC_MERCHANT_WALLET to .env.local'
        ]);
        setProcessingPayment(false);
        return;
      }

      // STEP 6: Validate payment amount
      if (paymentAmount <= 0) {
        setFormErrors([
          'Invalid price: Product price is $' + discountedPriceUsd.toFixed(2),
          'This product may not have a valid price set.',
          'Please contact support or try a different product.'
        ]);
        setProcessingPayment(false);
        return;
      }

      // STEP 6.5: Check USDT balance before attempting payment
      console.log('💰 Checking USDT balance before payment...');
      console.log('Current balance:', usdtBalance, 'USDT');
      console.log('Required amount:', paymentAmount, 'USDT');

      if (usdtBalance === null) {
        console.log('⚠️ Balance not loaded yet, fetching...');
        // Try to fetch balance one more time
        try {
          const freshBalance = await getBalance('USDT');
          setUsdtBalance(freshBalance);

          if (freshBalance === null || freshBalance < paymentAmount) {
            const network = process.env.NEXT_PUBLIC_SOLANA_RPC?.includes('devnet') ? 'devnet' : 'mainnet';
            setFormErrors([
              `Insufficient USDT balance`,
              `You have: ${freshBalance?.toFixed(2) || '0.00'} USDT`,
              `Required: ${paymentAmount.toFixed(2)} USDT`,
              '',
              network === 'devnet'
                ? '💡 Get devnet USDT from a faucet or airdrop service'
                : '💡 Purchase USDT on an exchange and transfer to your wallet'
            ]);
            setProcessingPayment(false);
            return;
          }
        } catch (error) {
          console.error('Failed to fetch balance:', error);
          setFormErrors(['Could not verify USDT balance. Please try again.']);
          setProcessingPayment(false);
          return;
        }
      } else if (usdtBalance < paymentAmount) {
        // Insufficient balance
        const network = process.env.NEXT_PUBLIC_SOLANA_RPC?.includes('devnet') ? 'devnet' : 'mainnet';
        setFormErrors([
          `Insufficient USDT balance`,
          `You have: ${usdtBalance.toFixed(2)} USDT`,
          `Required: ${paymentAmount.toFixed(2)} USDT`,
          `Shortfall: ${(paymentAmount - usdtBalance).toFixed(2)} USDT`,
          '',
          network === 'devnet'
            ? '💡 Get devnet USDT from a faucet: https://faucet.solana.com'
            : '💡 Purchase USDT on an exchange and transfer to your wallet',
          '',
          'Once you have enough USDT, click "Pay with USDT" again.'
        ]);
        setProcessingPayment(false);
        return;
      }

      console.log('✅ Balance check passed');

      console.log('Payment details:', {
        merchantAddress,
        originalPriceUsd: productPriceUsd,
        discountedPriceUsd: discountedPriceUsd,
        discount: userDiscountPercent + '%',
        token: 'USDT',
        tokenAmount: paymentAmount.toFixed(2),
        from: address,
        balance: usdtBalance
      });

      // STEP 7: Send USDT transaction and wait for confirmation
      let signature: string;
      try {
        // Show wallet authorization notification
        setWaitingForWalletAuth(true);

        const txSignature = await sendTransaction(merchantAddress, paymentAmount, 'USDT');

        // Hide wallet authorization notification after response
        setWaitingForWalletAuth(false);

        if (!txSignature) {
          setFormErrors([
            'Payment transaction failed',
            'No transaction signature was returned.',
            'Please try again or contact support if the issue persists.'
          ]);
          setProcessingPayment(false);
          return;
        }

        signature = txSignature;
        console.log('Transaction successful:', signature);
      } catch (txError: any) {
        // Hide wallet authorization notification on error
        setWaitingForWalletAuth(false);
        // Transaction failed - handle error in UI only (don't log to console)

        // Check if user cancelled the transaction
        if (txError?.message === 'USER_CANCELLED_TRANSACTION' || (txError as any)?.code === 'USER_CANCELLED') {
          console.log('ℹ️ User cancelled the transaction');
          setFormErrors([
            '❌ Transaction Cancelled',
            'You cancelled the transaction.',
            '',
            '✅ Your order has been cancelled. No payment was made.',
            '',
            'Click "Pay with USDT" again when you\'re ready to complete the purchase.'
          ]);
          setProcessingPayment(false);
          return;
        }

        // Handle other errors
        const errorMessage = txError?.message || txError?.toString() || 'Unknown transaction error';

        setFormErrors([
          'Payment transaction failed.',
          'Transaction signature is cancelled.',
          errorMessage,
          'Your wallet was not charged. Please try again.'
        ]);
        setProcessingPayment(false);
        return;
      }

      // STEP 8: Automatically create order after successful payment
      try {
        // Clear any old JWT token to ensure fresh authentication
        if (typeof window !== 'undefined') {
          const oldToken = window.localStorage.getItem('jwtToken');
          if (oldToken) {
            console.log("🧹 Clearing old JWT token for fresh authentication");
            window.localStorage.removeItem('jwtToken');
          }
        }

        // Authenticate wallet first
        console.log("🔑 Authentication Debug:");
        console.log("  Connected wallet address:", address);
        console.log("  Transaction signature:", signature);
        
        const authResult = await authenticateWallet({
          variables: {
            walletAddress: address,
          },
        });

        if (authResult.data?.authenticateWallet?.errors && authResult.data.authenticateWallet.errors.length > 0) {
          setFormErrors(["Authentication failed: " + authResult.data.authenticateWallet.errors.join(", ")]);
          setProcessingPayment(false);
          return;
        }

        if (!authResult.data?.authenticateWallet?.token) {
          setFormErrors(["Authentication failed: No token received"]);
          setProcessingPayment(false);
          return;
        }

        // Store JWT token
        const token = authResult.data.authenticateWallet.token;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('jwtToken', token);
          console.log("JWT token stored successfully");
        }

        // Create order with transaction signature
        console.log("Creating order with transaction signature:", signature);
        console.log("User data being sent:", userData);
        console.log("Payment token: USDT");
        console.log("Payment amount:", paymentAmount);
        console.log("🔍 BACKEND REQUEST DEBUG:", {
          topupProductItemId: productItem.id,
          transactionSignature: signature,
          userData: userData,
          cryptoCurrency: 'USDT',
          cryptoAmount: paymentAmount,
          cryptoAmountType: typeof paymentAmount,
          originalProductPrice: productItem.price,
          originalProductCurrency: productItem.currency,
          convertedToUSD: productPriceUsd,
          discountPercent: userDiscountPercent,
          discountedPriceUsd: discountedPriceUsd,
          roundedPaymentAmount: paymentAmount
        });
        const result = await createOrder({
          variables: {
            topupProductItemId: productItem.id,
            transactionSignature: signature,
            userData: Object.keys(userData).length > 0 ? userData : undefined,
            cryptoCurrency: 'USDT',
            cryptoAmount: paymentAmount,
          },
        });

        if (result.data?.createOrder?.errors && result.data.createOrder.errors.length > 0) {
          console.error('❌ Backend validation errors:', result.data.createOrder.errors);
          console.log('📦 Product item sent:', {
            id: productItem.id,
            price: productItem.price,
            displayName: productItem.displayName
          });
          setFormErrors([
            'Backend Error:',
            ...result.data.createOrder.errors,
            '',
            'Debug info:',
            `Product ID: ${productItem.id}`,
            `Product Price: $${productItem.price}`,
            `Payment Amount: ${paymentAmount} USDT`
          ]);
          setProcessingPayment(false);
        } else if (result.data?.createOrder?.order) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Order created successfully:', {
              cryptoAmount: result.data.createOrder.order.cryptoAmount,
              cryptoCurrency: result.data.createOrder.order.cryptoCurrency,
              cryptoTransaction: result.data.createOrder.order.cryptoTransaction,
              fullOrder: result.data.createOrder.order
            });
          }
          setOrderResult(result.data.createOrder.order);

          // Reset validation status after successful order
          setValidationStatus('idle');
          setValidationMessage('');

          // Automatically save game account after successful order
          if (Object.keys(userData).length > 0) {
            try {
              console.log('💾 Auto-saving game account...');

              // Extract accountId and serverId from userData
              // Common patterns: "User ID", "Player ID", "UID", "Account ID"
              const accountId = userData["User ID"] ||
                               userData["Player ID"] ||
                               userData["UID"] ||
                               userData["Account ID"] ||
                               userData[Object.keys(userData)[0]]; // Fallback to first field

              // Common patterns: "Server", "insert server value", "Region"
              const serverId = userData["insert server value"] ||
                              userData["Server"] ||
                              userData["Region"] ||
                              null;

              // Optional: In-game name if available
              const inGameName = userData["Character Name"] ||
                                userData["In-Game Name"] ||
                                null;

              // Debug logging for auto-save
              if (process.env.NODE_ENV === 'development') {
                console.log('💾 Auto-save game account details:', {
                  topupProductId: productItem.topupProductId,
                  productItem,
                  accountId,
                  serverId,
                  inGameName,
                });
              }

              // Only auto-save if topupProductId exists
              if (!productItem.topupProductId) {
                console.warn('⚠️ Cannot auto-save: topupProductId is missing');
              } else {
                const gameAccountResult = await createGameAccount({
                  variables: {
                    topupProductId: parseInt(productItem.topupProductId.toString()),
                  accountId: accountId,
                  serverId: serverId || undefined,
                  inGameName: inGameName || undefined,
                  userData: userData, // Complete form data
                },
              });

              if (gameAccountResult.data?.createGameAccount?.gameAccount) {
                console.log('✅ Game account auto-saved:', gameAccountResult.data.createGameAccount.gameAccount.id);
                // Refetch game accounts to show the newly saved account
                refetchGameAccounts();
              } else if (gameAccountResult.data?.createGameAccount?.errors) {
                console.warn('⚠️ Failed to auto-save game account:', gameAccountResult.data.createGameAccount.errors);
              }
            }
            } catch (gameAccountError) {
              console.error('Error auto-saving game account:', gameAccountError);
              // Don't fail the order if saving account fails
            }
          }

          setProcessingPayment(false);
          // Reset form
          setUserData({});
          // Clear cached user data from sessionStorage after successful purchase
          if (typeof window !== 'undefined') {
            const cacheKey = `tempUserData_${productItem.topupProductId}`;
            sessionStorage.removeItem(cacheKey);
            console.log('🧹 Cleared cached user data after successful purchase');
          }
        }
      } catch (orderErr: any) {
        console.error("Error creating order (attempt 1):", orderErr);

        // Retry logic for critical order creation - user has already paid!
        let retrySuccess = false;
        for (let attempt = 2; attempt <= 3; attempt++) {
          try {
            console.log(`🔄 Retrying order creation (attempt ${attempt}/3)...`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

            const retryResult = await createOrder({
              variables: {
                topupProductItemId: productItem.id,
                transactionSignature: signature,
                userData: Object.keys(userData).length > 0 ? userData : undefined,
                cryptoCurrency: 'USDT',
                cryptoAmount: paymentAmount,
              },
            });

            if (retryResult.data?.createOrder?.order) {
              console.log(`✅ Order created successfully on attempt ${attempt}`);
              setOrderResult(retryResult.data.createOrder.order);
              retrySuccess = true;
              break;
            } else if (retryResult.data?.createOrder?.errors) {
              console.error(`❌ Backend errors on attempt ${attempt}:`, retryResult.data.createOrder.errors);
            }
          } catch (retryErr) {
            console.error(`Error on retry attempt ${attempt}:`, retryErr);
          }
        }

        if (!retrySuccess) {
          // All retries failed - show error with transaction signature for support
          setFormErrors([
            '⚠️ Payment sent but order creation failed',
            '',
            'Your payment was successful but we could not create your order.',
            'Please contact support with this transaction signature:',
            '',
            signature,
            '',
            'Error: ' + (orderErr.message || 'Network error - Load failed')
          ]);
        }
        setProcessingPayment(false);
      }
    } catch (err: any) {
      // Handle payment errors in UI only (don't log to console)

      // Check if user cancelled the transaction
      if (err?.message === 'USER_CANCELLED_TRANSACTION' || (err as any)?.code === 'USER_CANCELLED') {
        console.log('ℹ️ User cancelled the transaction (outer catch)');
        setFormErrors([
          '❌ Transaction Cancelled',
          'You cancelled the transaction.',
          '',
          '✅ Your order has been cancelled. No payment was made.',
          '',
          'Click "Pay with USDT" again when you\'re ready to complete the purchase.'
        ]);
        setProcessingPayment(false);
        return;
      }

      // Handle empty error objects or missing error messages
      let errorMessage = 'Payment failed';
      if (err?.message) {
        errorMessage = err.message;
      } else if (err?.toString && err.toString() !== '[object Object]') {
        errorMessage = err.toString();
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      const errors = [errorMessage];

      // Add helpful tips if not already in error message
      if (!errorMessage.includes('faucet') && !errorMessage.includes('Insufficient balance') && !errorMessage.includes('cancelled')) {
        errors.push('Tip: Make sure you have enough USDT and SOL (for gas fees) in your wallet.');
      }

      setFormErrors(errors);
      setProcessingPayment(false);
    }
  }, [isConnected, address, connect, userInputFields, userData, productPriceUsd, sendTransaction, authenticateWallet, createOrder, currentUserData, productItem, createGameAccount, validateGameAccount, refetchGameAccounts, showConfirmation]);

  // FPX Payment Handler (Reown On-Ramp Integration)
  const handleFPXPayment = useCallback(async () => {
    if (!isConnected || !address) {
      setFormErrors(["Please connect your wallet first to proceed with FPX payment"]);
      return;
    }

    // Clear any existing errors
    setFormErrors([]);
    setProcessingPayment(true);

    try {
      // Calculate the final price (with discount if applicable)
      const finalPriceUsd = hasDiscount ? discountedPriceUsd : productPriceUsd;

      // Get country code from currency
      const COUNTRY_CODES: Record<string, string> = {
        'MYR': 'MY',
        'SGD': 'SG',
        'USD': 'US',
        'IDR': 'ID',
        'PHP': 'PH',
        'THB': 'TH',
        'VND': 'VN',
      };

      // Use user's selected currency
      const currencyCode = selectedCurrency.code;
      const minimumAmount = MINIMUM_AMOUNTS[currencyCode] || MINIMUM_AMOUNTS['MYR'];
      const countryCode = COUNTRY_CODES[currencyCode] || 'MY';

      console.log(`💳 Opening Meld for FPX/Card payment`);
      console.log(`   Product: ${productItem.displayName}`);
      console.log(`   Price: $${finalPriceUsd.toFixed(2)} USD`);
      console.log(`   Selected Currency: ${currencyCode}`);

      // Convert product price to selected currency
      const finalPriceInCurrency = convertPrice(finalPriceUsd, 'USD', currencyCode) || finalPriceUsd;

      // Calculate top-up amount in selected currency
      let topupAmount = Math.ceil(finalPriceInCurrency);
      topupAmount = Math.max(topupAmount, minimumAmount); // Ensure minimum

      // Convert back to USD for remaining balance calculation
      const topupAmountUsd = convertPrice(topupAmount, currencyCode, 'USD') || topupAmount;
      const remainingBalanceUsd = topupAmountUsd - finalPriceUsd;

      // Build Meld URL with dynamic amount
      const meldPublicKey = process.env.NEXT_PUBLIC_MELD_PUBLIC_KEY || 'WXETMuFUQmqqybHuRkSgxv:25B8LJHSfpG6LVjR2ytU5Cwh7Z4Sch2ocoU';
      const meldCustomerId = process.env.NEXT_PUBLIC_MELD_EXTERNAL_CUSTOMER_ID || '3640df604b8bb5d05ba846326433772c';

      const meldUrl = `https://meldcrypto.com/?` +
        `publicKey=${encodeURIComponent(meldPublicKey)}` +
        `&destinationCurrencyCode=SOL` + // Use SOL (Solana network only)
        `&walletAddress=${address}` +
        `&externalCustomerId=${meldCustomerId}` +
        `&sourceAmount=${topupAmount}` +
        `&sourceCurrencyCode=${currencyCode}` +
        `&countryCode=${countryCode}`;

      console.log(`   💳 Preparing Meld payment confirmation`);
      console.log(`   Amount: ${topupAmount} ${currencyCode} (~$${topupAmountUsd.toFixed(2)} USD)`);
      console.log(`   💡 User will receive SOL (Solana) to wallet: ${address}`);

      // Show confirmation modal before opening Meld
      setFpxConfirmData({
        topupAmountUsd,
        topupAmount,
        currencyCode,
        currencySymbol: selectedCurrency.symbol,
        productPrice: finalPriceUsd,
        remainingBalance: remainingBalanceUsd,
        meldUrl
      });
      setShowFPXConfirmModal(true);
      setProcessingPayment(false);

    } catch (err: any) {
      console.error("Error opening Meld:", err);
      setFormErrors([
        '❌ Failed to open Meld payment gateway.',
        'Error: ' + (err.message || 'Unknown error')
      ]);
      setProcessingPayment(false);
    }
  }, [isConnected, address, productItem, productPriceUsd, discountedPriceUsd, hasDiscount]);

  // Handle FPX confirmation - user clicks "Yes"
  const handleFPXConfirm = useCallback(() => {
    if (!fpxConfirmData) return;

    // Open Meld in new window
    window.open(fpxConfirmData.meldUrl, '_blank', 'width=500,height=700,scrollbars=yes');

    // Close modal and clear errors
    setShowFPXConfirmModal(false);
    setFpxConfirmData(null);
    setFormErrors([]); // Clear any existing errors
  }, [fpxConfirmData]);

  // Handle FPX cancel - user clicks "No"
  const handleFPXCancel = useCallback(() => {
    setShowFPXConfirmModal(false);
    setFpxConfirmData(null);
    setFormErrors([]);
  }, []);

  if (orderResult) {
    return (
      <div className="rounded-lg bg-green-500/10 p-6 backdrop-blur-md">
        <div className="mb-2 flex items-center gap-2">
          <svg
            className="h-8 w-8 text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="text-2xl font-bold text-green-400">Order Created Successfully!</h3>
        </div>

        <div className="space-y-3 rounded-lg bg-white/5 p-2">
          <div className="flex justify-between border-b border-white/10 pb-2">
            <span className="text-sm opacity-70">Order Number:</span>
            <span className="font-mono font-semibold">{orderResult.orderNumber}</span>
          </div>
          {/* Display crypto amount - use cryptoTransaction data if top-level fields are filtered */}
          {(() => {
            const cryptoAmount = orderResult.cryptoAmount && orderResult.cryptoAmount !== "[FILTERED]"
              ? orderResult.cryptoAmount
              : orderResult.cryptoTransaction?.amount;
            const cryptoCurrency = orderResult.cryptoCurrency && orderResult.cryptoCurrency !== "[FILTERED]"
              ? orderResult.cryptoCurrency
              : orderResult.cryptoTransaction?.token;
            
            // Show crypto amount if available, otherwise show fiat amount
            if (cryptoAmount && cryptoCurrency) {
              return (
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-sm opacity-70">Amount:</span>
                  <span className="font-mono font-semibold text-green-400">
                    {typeof cryptoAmount === 'number' ? cryptoAmount.toFixed(6) : cryptoAmount} {cryptoCurrency}
                  </span>
                </div>
              );
            }
            
            // Fallback to fiat amount
            return (
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-sm opacity-70">Amount:</span>
                <span className="font-semibold">
                  {orderResult.amount} {orderResult.currency}
                </span>
              </div>
            );
          })()}
          <div className="flex justify-between border-b border-white/10 pb-2">
            <span className="text-sm opacity-70">Status:</span>
            <span className="rounded bg-blue-500/20 px-2 py-1 text-xs font-semibold uppercase text-blue-300">
              {orderResult.status}
            </span>
          </div>
          <div className="flex justify-between border-b border-white/10 pb-2">
            <span className="text-sm opacity-70">Order Type:</span>
            <span className="text-sm">{orderResult.orderType}</span>
          </div>
          {orderResult.cryptoTransaction && (
            <>
              <div className="mt-4 pt-4 border-t border-white/20">
                <h4 className="text-sm font-semibold opacity-70 mb-2">Transaction Details:</h4>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-sm opacity-70">Network:</span>
                <span className="text-sm">{orderResult.cryptoTransaction.network}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-sm opacity-70">Token:</span>
                <span className="text-sm">{orderResult.cryptoTransaction.token}</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-sm opacity-70">Signature:</span>
                <span className="font-mono text-xs break-all">
                  {orderResult.cryptoTransaction.transactionSignature}
                </span>
              </div>
            </>
          )}

          {/* Display User Input Data (Game Account Info) */}
          {orderResult.metadata && Object.keys(orderResult.metadata).length > 0 && (
            <>
              <div className="mt-4 pt-4 border-t border-white/20">
                <h4 className="text-sm font-semibold opacity-70 mb-2">Game Account Details:</h4>
              </div>
              {Object.entries(orderResult.metadata).map(([key, value]) => (
                <div key={key} className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-sm opacity-70">{key}:</span>
                  <span className="text-sm font-semibold">{String(value)}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="mt-4 space-y-2">
          <button
            onClick={() => window.location.href = `/orders/${orderResult.id}`}
            className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 font-semibold transition hover:from-blue-600 hover:to-purple-600"
          >
            View Order Details
          </button>
          <button
            onClick={() => setOrderResult(null)}
            className="w-full rounded-lg bg-white/10 px-4 py-2 font-semibold transition hover:bg-white/20"
          >
            Create Another Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white/10 p-3 backdrop-blur-md">
      <h3 className="mb-2 text-lg font-bold">Complete Your Purchase</h3>

      {/* Product Item Details - Compact/Expanded View */}
      {productConfirmed ? (
        /* Compact View - Selected Product Only */
        <div className="mb-2 rounded-lg bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/20 rounded-lg px-2 py-1">
                <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{productItem.displayName || productItem.name}</p>
                <p className="text-xs opacity-70">
                  {hasDiscount ? (
                    <>
                      <span className="line-through opacity-60 mr-2">{formatPrice(convertedPrice, selectedCurrency)}</span>
                      <span className="text-green-400 font-bold">{formatPrice(discountedPrice, selectedCurrency)}</span>
                    </>
                  ) : (
                    <span className="font-semibold">{formatPrice(convertedPrice, selectedCurrency)}</span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setProductConfirmed(false);
                // If callback provided, call it to show all products again
                if (onChangeProduct) {
                  onChangeProduct();
                }
              }}
              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition"
            >
              Change
            </button>
          </div>
        </div>
      ) : (
        /* Full View - All Product Details */
        <div className="mb-3 rounded-lg bg-white/5 p-2">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-base font-semibold">{productItem.displayName || productItem.name}</p>
              <p className="text-xs opacity-60">Item ID: {productItem.id}</p>
            </div>
            <div className="text-right">
              {/* Show price in selected currency */}
              {hasDiscount ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                    <p className="text-sm font-medium" style={{ textDecoration: 'line-through', opacity: 0.6 }}>
                      {formatPrice(convertedPrice, selectedCurrency)}
                    </p>
                    <p className="text-lg font-bold" style={{ color: '#00C853' }}>
                      {formatPrice(discountedPrice, selectedCurrency)}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-wrap mt-1 justify-end">
                    {selectedVoucherId && voucherDiscountPercent > 0 ? (
                      // Show ONLY voucher discount if voucher is selected
                      <span style={{
                        fontSize: '0.75em',
                        background: '#9C27B0',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        display: 'inline-block'
                      }}>
                        {voucherDiscountPercent}% Voucher Discount
                      </span>
                    ) : userDiscountPercent > 0 ? (
                      // Show ONLY tier discount if no voucher selected but user has tier
                      <span style={{
                        fontSize: '0.75em',
                        background: '#00C853',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        display: 'inline-block'
                      }}>
                        {userDiscountPercent}% VIP Tier Discount
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-2xl font-bold">
                  {formatPrice(convertedPrice, selectedCurrency)}
                </p>
              )}
              {selectedCurrency.code !== 'USD' && (
                <p className="text-sm opacity-70 mt-1">
                  {hasDiscount && (
                    <span style={{ textDecoration: 'line-through', opacity: 0.6, marginRight: '8px' }}>
                      ${productPriceUsd.toFixed(2)}
                    </span>
                  )}
                  <span style={hasDiscount ? { color: '#00C853', fontWeight: 'bold' } : {}}>
                    ≈ ${hasDiscount ? discountedPriceUsd.toFixed(2) : productPriceUsd.toFixed(2)} USD
                  </span>
                </p>
              )}
              <p className="text-xs opacity-60 mt-1">
                {hasDiscount && (
                  <span style={{ textDecoration: 'line-through', opacity: 0.6, marginRight: '8px' }}>
                    {productPriceUsd.toFixed(2)} USDT
                  </span>
                )}
                <span style={hasDiscount ? { color: '#00C853', fontWeight: 'bold' } : {}}>
                  Payment: {hasDiscount ? discountedPriceUsd.toFixed(2) : productPriceUsd.toFixed(2)} USDT
                </span>
              </p>
            </div>
          </div>
          {/* Confirm Selection Button */}
          <button
            onClick={() => setProductConfirmed(true)}
            className="w-full rounded-lg bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 px-3 py-2 text-sm font-semibold text-blue-300 transition hover:from-blue-500/30 hover:to-purple-500/30"
          >
            ✓ Confirm Selection
          </button>
        </div>
      )}

      {/* USDT Balance Display - Animated */}
      <div
        className={`transition-all duration-500 ease-in-out overflow-hidden ${
          isConnected
            ? 'max-h-[300px] opacity-100'
            : 'max-h-0 opacity-0 pointer-events-none'
        }`}
      >
      </div>

      {/* Error Display */}
      {formErrors.length > 0 && (
        <div className={`mb-2 rounded-lg border p-2 ${
          formErrors[0]?.includes('Cancelled') || formErrors[0]?.includes('cancelled')
            ? 'bg-blue-500/10 border-blue-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <h4 className={`mb-2 font-semibold ${
            formErrors[0]?.includes('Cancelled') || formErrors[0]?.includes('cancelled')
              ? 'text-blue-300'
              : 'text-red-300'
          }`}>
            {formErrors[0]?.includes('Cancelled') || formErrors[0]?.includes('cancelled') ? 'Notice:' : 'Errors:'}
          </h4>
          <ul className={`list-inside text-sm ${
            formErrors[0]?.includes('Cancelled') || formErrors[0]?.includes('cancelled')
              ? 'text-blue-200 space-y-1'
              : 'list-disc text-red-200'
          }`}>
            {formErrors.map((error, index) => (
              <li key={index} className={error.startsWith('✅') || error.startsWith('❌') ? 'list-none' : ''}>
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Purchase Form */}
      <div className="space-y-2">
        {/* Saved Game Accounts Selector - Animated */}
        {isConnected && filteredGameAccounts.length > 0 && (
          <div
            className={`transition-all duration-500 ease-in-out overflow-hidden ${
              accountSectionCollapsed
                ? 'max-h-0 opacity-0 pointer-events-none'
                : 'max-h-[1000px] opacity-100'
            }`}
          >
            <div className="space-y-2 rounded-lg bg-green-500/10 border border-green-500/30 p-2 mb-2 mx-4">
              <h4 className="text-xs font-semibold text-green-300">✨ Recent Used Accounts</h4>
              <div className="space-y-1">
              {filteredGameAccounts.map((account) => (
                <div
                  key={account.id}
                  className={`rounded-lg p-2 transition ${
                    selectedGameAccountId === account.id
                      ? 'bg-green-500/20 ring-2 ring-green-400'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {/* Row 1: Account Name and Buttons */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-medium text-white truncate">
                        {account.inGameName && account.inGameName !== account.accountId
                          ? account.inGameName
                          : (account.displayName || (account.accountId ? `Account ${account.accountId.slice(0, 8)}...` : 'Saved Account'))}
                      </span>
                      {/* Verification Status */}
                      {account.approve ? (
                        <span className="text-xs text-green-400 whitespace-nowrap">✓ Verified</span>
                      ) : (
                        <span className="text-xs text-orange-400 whitespace-nowrap">⚠ Unverified</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Show Verify button for unverified accounts */}
                      {!account.approve && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              console.log('🔍 Verifying account:', account.id);
                              const result = await validateGameAccount({
                                variables: {
                                  gameAccountId: parseInt(account.id)
                                }
                              });
                              if (result.data?.validateGameAccountMutation?.gameAccount) {
                                console.log('✅ Account verified:', result.data.validateGameAccountMutation.gameAccount);
                                refetchGameAccounts();
                              }
                            } catch (err) {
                              console.error('❌ Verification error:', err);
                            }
                          }}
                          className="rounded-lg bg-green-500/20 px-2.5 py-1.5 text-xs text-green-300 hover:bg-green-500/30 transition"
                          title="Verify this account"
                        >
                          🔍
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleLoadGameAccount(account.id)}
                        className="rounded-lg bg-blue-500/20 px-2.5 py-1.5 text-xs text-blue-300 hover:bg-blue-500/30 transition"
                        title="Select this account"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGameAccount(account.id)}
                        className="rounded-lg bg-red-500/20 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/30 transition"
                        title="Delete this account"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Account Details */}
                  <div className="text-xs space-y-1">
                    {/* Display all fields from userData dynamically */}
                    {account.userData && typeof account.userData === 'object' && Object.entries(account.userData).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-blue-300 font-semibold whitespace-nowrap">{key}:</span>
                        <span className="font-mono text-white truncate" title={String(value)}>{String(value)}</span>
                      </div>
                    ))}
                    {/* Fallback if no userData */}
                    {(!account.userData || Object.keys(account.userData).length === 0) && (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-blue-300 font-semibold whitespace-nowrap">Game ID:</span>
                          <span className="font-mono text-white truncate" title={account.accountId || undefined}>{account.accountId}</span>
                        </div>
                        {account.serverId && (
                          <div className="flex items-center gap-2">
                            <span className="text-purple-300 font-semibold whitespace-nowrap">Server:</span>
                            <span className="text-white truncate" title={account.serverId || undefined}>{account.serverId}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            </div>
          </div>
        )}

        {/* User Input Fields */}
        {userInputFields.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold opacity-70">Game Account Information</h4>
              {/* Show Change Account button if accounts section is collapsed and user has saved accounts */}
              {accountSectionCollapsed && isConnected && filteredGameAccounts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAccountSectionCollapsed(false)}
                  className="px-2 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-xs font-semibold text-blue-300 transition"
                >
                  🔄 Change Account
                </button>
              )}
              {/* Status Badge */}
              {validationStatus !== 'idle' && validationMessage && (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  validationStatus === 'validating' ? 'bg-blue-500/10 text-blue-400' :
                  validationStatus === 'valid' ? 'bg-green-500/10 text-green-400' :
                  'bg-red-500/10 text-red-400'
                }`}>
                  {validationStatus === 'validating' && (
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                  )}
                  {validationStatus === 'valid' && <span>✓</span>}
                  {validationStatus === 'invalid' && <span>✗</span>}
                  <span>{validationMessage}</span>
                </div>
              )}
            </div>
            {userInputFields.map((field: any, index: number) => {
              const fieldName = field.name || field.key || `field_${index}`;
              const fieldLabel = field.label || field.name || field.key || 'Field';
              const fieldType = field.type || 'text';
              const fieldPlaceholder = field.placeholder || `Enter ${fieldLabel}`;
              const fieldTag = field.tag || 'input';

              // Check if this is a Player ID / User ID / Account ID field for clear button
              const accountIdPatterns = ['Player ID', 'User ID', 'UID', 'Account ID', 'player_id', 'user_id', 'uid', 'account_id'];
              const isAccountIdField = accountIdPatterns.some(pattern =>
                fieldName.toLowerCase().includes(pattern.toLowerCase()) ||
                fieldLabel.toLowerCase().includes(pattern.toLowerCase())
              );

              // Check if this is a Server ID field for clear button
              const serverIdPatterns = ['Server', 'server', 'Server ID', 'server_id', 'insert server value', 'Region', 'region'];
              const isServerIdField = serverIdPatterns.some(pattern =>
                fieldName.toLowerCase().includes(pattern.toLowerCase()) ||
                fieldLabel.toLowerCase().includes(pattern.toLowerCase())
              );

              return (
                <div key={`input-${index}-${fieldName}`}>
                  <label className="mb-0.5 block text-xs font-medium">
                    {fieldLabel}
                    {field.required && <span className="text-red-400"> *</span>}
                  </label>

                  {/* Render regular select for dropdown fields OR simple input for all others */}
                  {(fieldTag === 'dropdown' && field.options && Array.isArray(field.options)) ? (
                    /* Regular select dropdown for non-account fields */
                    <select
                      value={userData[fieldName] || ""}
                      onChange={(e) => handleInputChange(fieldName, e.target.value)}
                      className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/20 transition focus:ring-2 focus:ring-blue-400"
                      required={field.required}
                    >
                      <option value="" disabled className="bg-gray-800">
                        {fieldPlaceholder}
                      </option>
                      {field.options.map((option: any, optIndex: number) => (
                        <option
                          key={`${fieldName}-option-${optIndex}`}
                          value={option.value}
                          className="bg-gray-800"
                        >
                          {option.text || option.value}
                        </option>
                      ))}
                    </select>
                  ) : (
                    /* Render input field */
                    <div className="space-y-2">
                      <div className="relative">
                        <input
                          type={fieldType === "number" ? "number" : "text"}
                          placeholder={fieldPlaceholder}
                          value={userData[fieldName] || ""}
                          onChange={(e) => handleInputChange(fieldName, e.target.value)}
                          className={`w-full rounded-lg bg-white/5 px-3 py-2 ${(isAccountIdField || isServerIdField) && userData[fieldName] ? 'pr-10' : 'pr-3'} text-sm text-white placeholder-white/40 outline-none ring-1 transition focus:ring-2 ${
                            validationStatus === 'validating' ? 'ring-blue-400/50' :
                            validationStatus === 'valid' ? 'ring-green-400/50' :
                            validationStatus === 'invalid' ? 'ring-red-400/50' :
                            'ring-white/20 focus:ring-blue-400'
                          }`}
                          required={field.required}
                        />
                        {/* Clear button for Player ID and Server ID fields */}
                        {(isAccountIdField || isServerIdField) && userData[fieldName] && (
                          <button
                            type="button"
                            onClick={() => {
                              handleInputChange(fieldName, '');
                              setSelectedGameAccountId(null);
                              setValidationStatus('idle');
                              setValidationMessage('');
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition"
                            title="Clear"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {field.description && (
                    <p className="mt-1 text-xs opacity-60">{field.description}</p>
                  )}
                </div>
              );
            })}

            {/* Account Summary - Show only IGN or Game ID */}
            {isConnected && Object.keys(userData).length > 0 && (
              <div className={`rounded-lg border p-2 ${verifiedIGN ? 'bg-green-500/10 border-green-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
                {verifiedIGN ? (
                  /* Show only IGN if verified */
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm text-white/60">In-Game Name:</span>
                    </div>
                    <span className="text-lg font-bold text-green-400">{verifiedIGN}</span>
                  </div>
                ) : (
                  /* Show only Game ID if no IGN */
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="text-sm text-white/60">Game ID:</span>
                    </div>
                    <span className="text-lg font-bold text-blue-400">
                      {userData["User ID"] || userData["Player ID"] || userData["UID"] || userData["Account ID"] || 'N/A'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Optional: Verify Account & Save IGN Button */}
            {isConnected && Object.keys(userData).length > 0 && !verifiedIGN && (
              <button
                type="button"
                onClick={handleVerifyAccount}
                disabled={isVerifying}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg border border-purple-500/50 text-sm text-purple-300 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isVerifying ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Verifying...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Verify & Save Account (Optional)
                  </>
                )}
              </button>
            )}

            {/* Voucher Selection */}
            {activeVouchers && activeVouchers.length > 0 && (
              <div className="mb-2 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 p-2">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" />
                  </svg>
                  <h4 className="text-sm font-semibold text-purple-300">Active Vouchers</h4>
                </div>

                <div className="space-y-2">
                  {/* No voucher option */}
                  <label className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition cursor-pointer border border-transparent hover:border-white/20">
                    <input
                      type="radio"
                      name="voucher"
                      value=""
                      checked={!selectedVoucherId}
                      onChange={() => setSelectedVoucherId(null)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-white/70">No voucher</span>
                  </label>

                  {/* Available vouchers */}
                  {activeVouchers.map((voucher) => (
                    <label
                      key={voucher.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition cursor-pointer border border-transparent hover:border-purple-500/30"
                    >
                      <input
                        type="radio"
                        name="voucher"
                        value={voucher.id}
                        checked={selectedVoucherId === voucher.id}
                        onChange={() => setSelectedVoucherId(voucher.id)}
                        className="w-4 h-4"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-purple-300">
                            {voucher.discountPercent}% Discount
                          </span>
                          {!voucher.used && (
                            <span className="text-xs bg-green-500/30 text-green-300 px-2 py-0.5 rounded-full">
                              Unused
                            </span>
                          )}
                          {voucher.used && (
                            <span className="text-xs bg-gray-500/30 text-gray-300 px-2 py-0.5 rounded-full">
                              Used
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/50 mt-0.5">
                          Type: {voucher.voucherType || 'Standard'} • Expires: {new Date(voucher.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-2">
            <p className="text-sm text-yellow-300">
              No user input fields configured for this product. Check the console for debugging info.
            </p>
          </div>
        )}

        {/* Email Verification Section - Only show if connected */}
        {isConnected && currentUserData?.currentUser && (!currentUserData.currentUser.email || !currentUserData.currentUser.emailVerified) && (
          <div className="rounded-lg bg-orange-500/10 border border-orange-500/30 p-2">
            <h4 className="mb-2 font-semibold text-orange-300">
              📧 {!currentUserData.currentUser.email ? 'Email Required' : 'Email Verification Required'}
            </h4>
            <p className="mb-3 text-sm text-orange-200">
              {!currentUserData.currentUser.email
                ? 'Please add your email address to receive order updates and receipts.'
                : 'Please verify your email to receive order updates and receipts.'
              }
            </p>
            {currentUserData.currentUser.email ? (
              <div className="space-y-2">
                <p className="text-sm text-orange-100">
                  Current email: <span className="font-semibold">{currentUserData.currentUser.email}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setShowEmailModal(true)}
                  className="w-full rounded-lg bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2 font-semibold text-white transition hover:from-orange-600 hover:to-red-600"
                >
                  Verify Email Now
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowEmailModal(true)}
                className="w-full rounded-lg bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2 font-semibold text-white transition hover:from-orange-600 hover:to-red-600"
              >
                Add & Verify Email
              </button>
            )}
          </div>
        )}

        {/* Wallet Payment Section */}
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-2">
          <h4 className="mb-2 font-semibold text-blue-300">💳 Payment with Wallet</h4>

          {!isConnected ? (
            /* Not Connected */
            <>
              <p className="mb-3 text-sm text-blue-200">
                Connect your wallet to pay with crypto
              </p>
              <button
                type="button"
                onClick={connect}
                className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-3 py-2 font-semibold text-white transition hover:from-blue-600 hover:to-purple-600"
              >
                🔗 Connect Wallet to Pay
              </button>
            </>
          ) : (
            /* Connected - Ready to Pay */
            <>
              <p className="mb-2 text-sm text-blue-200">
                Wallet connected: <span className="font-mono">{address?.slice(0, 4)}...{address?.slice(-4)}</span>
              </p>

              {/* Wallet Authorization Notification - Show when waiting for user to approve in wallet */}
              {waitingForWalletAuth && (
                <div className="mb-3 rounded-lg bg-orange-500/20 border-2 border-orange-400 p-3 animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-orange-300 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h5 className="font-bold text-orange-300 mb-1 text-sm">📱 Check Your Wallet App!</h5>
                      <p className="text-xs text-orange-200 leading-relaxed">
                        Please open your wallet app (Phantom, Trust Wallet, etc.) to <strong>approve the transaction</strong>.
                      </p>
                      <p className="text-xs text-orange-200 mt-1">
                        💡 Look for a notification or pending transaction in your wallet.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Amount Display */}
              <div className="mb-3 rounded-lg bg-white/5 p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm opacity-70">Price:</span>
                  <div className="text-right">
                    {hasDiscount ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ textDecoration: 'line-through', opacity: 0.6, fontSize: '0.9em' }}>
                          {formatPrice(convertedPrice, selectedCurrency)}
                        </span>
                        <span className="font-semibold" style={{ color: '#00C853' }}>
                          {formatPrice(discountedPrice, selectedCurrency)}
                        </span>
                      </div>
                    ) : (
                      <span className="font-semibold">
                        {formatPrice(convertedPrice, selectedCurrency)}
                      </span>
                    )}
                  </div>
                </div>
                {(selectedVoucherId && voucherDiscountPercent > 0) || userDiscountPercent > 0 ? (
                  <div className="flex justify-between items-center mb-1">
                    <span></span>
                    <span style={{
                      fontSize: '0.65em',
                      background: selectedVoucherId && voucherDiscountPercent > 0 ? '#9C27B0' : '#00C853',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      -{selectedVoucherId && voucherDiscountPercent > 0 ? voucherDiscountPercent : userDiscountPercent}% {selectedVoucherId && voucherDiscountPercent > 0 ? 'Voucher' : 'VIP'} Discount
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm opacity-70">You will pay:</span>
                  <div className="text-right">
                    {(selectedVoucherId && voucherDiscountPercent > 0) || userDiscountPercent > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ textDecoration: 'line-through', opacity: 0.6, fontSize: '0.9em' }}>
                          {productPriceUsd.toFixed(2)} USDT
                        </span>
                        <span className="font-mono font-bold text-green-400">
                          {discountedPriceUsd.toFixed(2)} USDT
                        </span>
                      </div>
                    ) : (
                      <span className="font-mono font-bold text-green-400">
                        {productPriceUsd.toFixed(2)} USDT
                      </span>
                    )}
                  </div>
                </div>
                {/* Current Balance Display */}
                <div className={`flex justify-between items-center pt-2 border-t ${
                  usdtBalance !== null && usdtBalance < (hasDiscount ? discountedPriceUsd : productPriceUsd)
                    ? 'border-red-500/30'
                    : 'border-green-500/30'
                }`}>
                  <span className="text-sm opacity-70">Current balance:</span>
                  <div className="text-right flex items-center gap-2">
                    {usdtBalance !== null && usdtBalance < (hasDiscount ? discountedPriceUsd : productPriceUsd) && (
                      <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                      </svg>
                    )}
                    <span className={`font-mono font-bold ${
                      usdtBalance !== null && usdtBalance < (hasDiscount ? discountedPriceUsd : productPriceUsd)
                        ? 'text-red-400'
                        : 'text-green-400'
                    }`}>
                      {usdtBalance !== null ? usdtBalance.toFixed(2) : '0.00'} USDT
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleWalletPayment}
                disabled={processingPayment || (usdtBalance !== null && usdtBalance < (hasDiscount ? discountedPriceUsd : productPriceUsd))}
                className={`w-full rounded-lg px-3 py-2 font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  usdtBalance !== null && usdtBalance < (hasDiscount ? discountedPriceUsd : productPriceUsd)
                    ? 'bg-gradient-to-r from-gray-500 to-gray-600'
                    : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
                }`}
              >
                {processingPayment ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    {waitingForWalletAuth ? 'Waiting for wallet approval...' : 'Processing Payment...'}
                  </span>
                ) : usdtBalance !== null && usdtBalance < (hasDiscount ? discountedPriceUsd : productPriceUsd) ? (
                  <span className="flex flex-col items-center gap-1 text-sm">
                    <span>💰 Pay {hasDiscount ? discountedPriceUsd.toFixed(2) : productPriceUsd.toFixed(2)} USDT</span>
                    <span className="text-xs text-gray-300">
                      Current balance: {usdtBalance.toFixed(2)} USDT - Insufficient: Need {((hasDiscount ? discountedPriceUsd : productPriceUsd) - usdtBalance).toFixed(2)} more USDT
                    </span>
                  </span>
                ) : (
                  `💰 Pay ${hasDiscount ? discountedPriceUsd.toFixed(2) : productPriceUsd.toFixed(2)} USDT`
                )}
              </button>

              {/* FPX Payment Option - Reown On-Ramp */}
              <div className="mt-3 border-t border-purple-500/30 pt-3">
                <p className="mb-2 text-xs text-purple-300">Or pay with:</p>
                <button
                  type="button"
                  onClick={handleFPXPayment}
                  disabled={processingPayment}
                  className="w-full rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 px-3 py-2 text-sm font-semibold text-purple-300 transition hover:from-purple-500/30 hover:to-pink-500/30 disabled:opacity-50"
                >
                  {processingPayment ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      Redirecting to payment...
                    </span>
                  ) : (
                    `🏦 Topup & Pay ${Math.max(hasDiscount ? discountedPriceUsd : productPriceUsd, MINIMUM_AMOUNTS['USD']).toFixed(2)} USD with FPX/Card`
                  )}
                </button>
                <p className="mt-2 text-xs text-purple-400/60">
                  Supports: FPX (Malaysia), Credit/Debit Cards, Bank Transfer
                </p>
                {(hasDiscount ? discountedPriceUsd : productPriceUsd) < MINIMUM_AMOUNTS['USD'] && (
                  <p className="mt-2 text-xs text-yellow-400/80">
                    ℹ️ Minimum topup: ${MINIMUM_AMOUNTS['USD'].toFixed(2)} USD (Product price is below minimum)
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3">
          <p className="text-sm text-red-300">Network Error: {error.message}</p>
        </div>
      )}

      {/* Email Verification Modal */}
      {showEmailModal && (
        <EmailVerificationModal
          currentEmail={currentUserData?.currentUser?.email}
          emailVerified={currentUserData?.currentUser?.emailVerified}
          onVerified={() => {
            refetchUser();
            setShowEmailModal(false);
          }}
          onClose={() => setShowEmailModal(false)}
          mandatory={true} // Force email verification before purchase
        />
      )}

      {/* FPX/Meld Payment Confirmation Modal */}
      {showFPXConfirmModal && fpxConfirmData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleFPXCancel();
            }
          }}
        >
          <div className="w-full max-w-md rounded-lg bg-gradient-to-br from-blue-900 to-blue-800 p-6 shadow-2xl border border-blue-500/30">
            {/* Header */}
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <svg className="h-7 w-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Confirm Payment
              </h3>
              <button
                onClick={handleFPXCancel}
                className="text-gray-400 hover:text-white transition"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="mb-3 space-y-4">
              <div className="rounded-lg bg-white/10 p-2 backdrop-blur-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-300">Product Price:</span>
                    <span className="text-lg font-bold text-white">${fpxConfirmData.productPrice.toFixed(2)} USD</span>
                  </div>
                  <div className="border-t border-white/10 pt-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-300">Top-up Amount:</span>
                      <span className="text-lg font-bold text-blue-300">
                        {fpxConfirmData.currencySymbol}{fpxConfirmData.topupAmount.toLocaleString()} {fpxConfirmData.currencyCode}
                      </span>
                    </div>
                    <div className="text-right text-xs text-gray-400">
                      (~${fpxConfirmData.topupAmountUsd.toFixed(2)} USD)
                    </div>
                  </div>

                  {fpxConfirmData.remainingBalance > 0 && (
                    <div className="border-t border-white/10 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-300">Remaining Balance:</span>
                        <span className="text-lg font-semibold text-green-400">${fpxConfirmData.remainingBalance.toFixed(2)} USD</span>
                      </div>
                      <p className="mt-2 text-xs text-gray-400 bg-blue-500/10 rounded p-2">
                        ℹ️ Minimum top-up is {MINIMUM_AMOUNTS[fpxConfirmData.currencyCode]} {fpxConfirmData.currencyCode}. The remaining SOL balance will stay in your wallet after purchase.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-2">
                <p className="text-sm text-blue-200 mb-2">
                  <strong>Payment Method:</strong> FPX / Credit Card via Meld
                </p>
                <p className="text-sm text-blue-200 mb-2">
                  <strong>Network:</strong> Solana
                </p>
                <p className="text-sm text-blue-200">
                  <strong>You'll receive:</strong> SOL to your wallet
                </p>
              </div>

              <div className="text-sm text-gray-300 space-y-2">
                <p className="flex items-start gap-2">
                  <span className="text-blue-400 flex-shrink-0">1.</span>
                  <span>Complete payment in Meld window</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-blue-400 flex-shrink-0">2.</span>
                  <span>SOL will be sent to your Solana wallet</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-blue-400 flex-shrink-0">3.</span>
                  <span>Swap SOL to USDT, then pay with wallet USDT</span>
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleFPXCancel}
                className="flex-1 rounded-lg bg-gray-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleFPXConfirm}
                className="flex-1 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-3 py-2 text-sm font-semibold text-white transition hover:from-blue-600 hover:to-cyan-600 shadow-lg"
              >
                Proceed to Meld
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Insufficient Balance Alert Modal */}
      {showInsufficientBalanceModal && insufficientBalanceData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowInsufficientBalanceModal(false);
            }
          }}
        >
          <div className="w-full max-w-md rounded-lg bg-gradient-to-br from-red-900 to-orange-900 p-6 shadow-2xl border border-red-500/50">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <svg className="h-8 w-8 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
                Insufficient Balance
              </h3>
              <button
                onClick={() => setShowInsufficientBalanceModal(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="mb-4 space-y-4">
              <div className="rounded-lg bg-white/10 p-4 backdrop-blur-sm">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-300">Your USDT Balance:</span>
                    <span className="text-lg font-bold text-red-300">{insufficientBalanceData.currentBalance.toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-white/10 pt-3">
                    <span className="text-sm text-gray-300">Required Amount:</span>
                    <span className="text-lg font-bold text-white">{insufficientBalanceData.requiredAmount.toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-red-500/30 pt-3">
                    <span className="text-sm font-semibold text-red-300">You Need:</span>
                    <span className="text-xl font-bold text-red-400">{insufficientBalanceData.shortfall.toFixed(2)} USDT</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4">
                <p className="text-sm text-red-200 mb-3 font-semibold">
                  ⚠️ You don't have enough USDT to complete this purchase with your wallet.
                </p>
                <p className="text-sm text-red-200/80">
                  Please choose one of the options below:
                </p>
              </div>

              <div className="text-sm text-gray-300 space-y-2 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="font-semibold text-blue-300 mb-2">💡 Suggested Actions:</p>
                <p className="flex items-start gap-2">
                  <span className="text-blue-400 flex-shrink-0">1.</span>
                  <span>Top up USDT to your Solana wallet, or</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-blue-400 flex-shrink-0">2.</span>
                  <span>Use FPX/Card payment instead (no wallet balance needed)</span>
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowInsufficientBalanceModal(false)}
                className="flex-1 rounded-lg bg-gradient-to-r from-gray-600 to-gray-700 px-4 py-3 text-sm font-semibold text-white transition hover:from-gray-700 hover:to-gray-800 shadow-lg"
              >
                Noted
              </button>
              <button
                onClick={() => {
                  setShowInsufficientBalanceModal(false);
                  // Trigger FPX payment instead
                  handleFPXPayment();
                }}
                className="flex-1 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white transition hover:from-blue-600 hover:to-cyan-600 shadow-lg"
              >
                Use FPX/Card Instead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Confirmation Modal */}
      {showConfirmModal && confirmModalData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCancel();
            }
          }}
        >
          <div className="w-full max-w-md rounded-lg bg-gradient-to-br from-gray-900 to-gray-800 p-6 shadow-2xl border border-white/10">
            {/* Header */}
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">
                {confirmModalData.isDemo ? "Confirm Simulation" : "Confirm Payment"}
              </h3>
              <button
                onClick={handleCancel}
                className="text-gray-400 transition hover:text-white"
                aria-label="Close"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Account Details */}
            <div className={`mb-2 rounded-lg border p-2 ${confirmModalData.ign ? 'bg-green-500/10 border-green-500/30' : 'bg-orange-500/10 border-orange-500/30'}`}>
              {confirmModalData.ign ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-semibold text-green-300">Account Verified</span>
                  </div>
                  <div className="mb-2">
                    <p className="text-xs text-white/50">In-Game Name</p>
                    <p className="text-xl font-bold text-green-400">{confirmModalData.ign}</p>
                  </div>
                  <div className="pt-2 border-t border-green-500/20">
                    <p className="text-xs text-white/50">Game ID</p>
                    <p className="text-sm text-white/80">{confirmModalData.gameId}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-sm font-semibold text-orange-300">Could Not Retrieve IGN</span>
                  </div>
                  <div>
                    <p className="text-xs text-white/50">Game ID</p>
                    <p className="text-lg font-bold text-orange-400">{confirmModalData.gameId}</p>
                  </div>
                </>
              )}
            </div>

            {/* Payment Details */}
            <div className="mb-3 space-y-3 rounded-lg bg-blue-500/10 border border-blue-500/30 p-2">
              <div>
                <p className="text-xs text-white/50">Product</p>
                <p className="text-sm font-medium text-white">{confirmModalData.productName}</p>
              </div>
              {!confirmModalData.isDemo && (
                <div>
                  <p className="text-xs text-white/50">Amount</p>
                  <p className="text-lg font-bold text-blue-400">{confirmModalData.amount.toFixed(6)} SOL</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 rounded-lg bg-white/5 px-3 py-2 font-semibold text-white transition hover:bg-white/10 border border-white/20"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 rounded-lg bg-gradient-to-r from-green-500 to-blue-500 px-3 py-2 font-semibold text-white transition hover:from-green-600 hover:to-blue-600"
              >
                {confirmModalData.isDemo ? "Proceed with Simulation" : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PurchaseForm;
