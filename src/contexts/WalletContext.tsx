"use client";

import { createContext, ReactNode, useContext, useEffect, useState, useRef, useMemo } from "react";
import { useAppKit, useAppKitAccount, useAppKitProvider, useAppKitState } from '@reown/appkit/react';
import type { Provider } from '@reown/appkit-adapter-solana/react';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  TokenAccountNotFoundError
} from '@solana/spl-token';
import { useAuthenticateWalletMutation, useCurrentUserQuery } from "graphql/generated/graphql";
import { modal } from '@/lib/reown-config';
import { clearApolloCache } from '@/lib/apollo-client';
import { getTokenMintAddress, getNetworkFromRPC, isNativeSOL, getTokenConfig } from '@/lib/tokens';
import { useUser } from '@/contexts/UserContext';

interface WalletContextType {
  // Connection state
  isConnected: boolean;
  address: string | undefined;
  isConnecting: boolean;
  isLoadingUserData: boolean;

  // Actions
  connect: () => void;
  disconnect: () => void;

  // Solana specific
  signMessage: (message: string) => Promise<string | null>;
  sendTransaction: (to: string, amount: number, tokenSymbol?: string) => Promise<string | null>;
  getBalance: (tokenSymbol?: string) => Promise<number | null>;

  // SPL Token specific
  getTokenBalance: (tokenSymbol: string) => Promise<number | null>;
  sendTokenTransaction: (to: string, amount: number, tokenSymbol: string) => Promise<string | null>;

  // Reown modal
  openModal: () => void;
  closeModal: () => void;

  // Authentication errors
  authError: string | null;
  clearAuthError: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const appKit = useAppKit();
  const { open, close } = appKit;
  const { address: appKitAddress, isConnected: appKitIsConnected, caipAddress, status, embeddedWalletInfo } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<Provider>('solana');
  const appKitState = useAppKitState();
  const { setUser } = useUser();

  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);
  const [authenticateWallet] = useAuthenticateWalletMutation();

  // Automatically fetch current user when connected and has JWT token
  const hasJwtToken = typeof window !== 'undefined' && !!window.localStorage.getItem('jwtToken');
  const { data: currentUserData, refetch: refetchCurrentUser, loading: currentUserLoading } = useCurrentUserQuery({
    skip: !appKitIsConnected || !hasJwtToken,
    fetchPolicy: 'network-only',
  });

  const [authError, setAuthError] = useState<string | null>(null);

  // Extract email from embeddedWalletInfo to prevent infinite loop
  // Only extract the email value, not the entire object reference
  const socialEmail = useMemo(() => {
    return embeddedWalletInfo?.user?.email || null;
  }, [embeddedWalletInfo?.user?.email]);

  // Update user context when currentUser query returns data
  useEffect(() => {
    if (currentUserData?.currentUser) {
      console.log('✅ Current user data fetched, updating user context');
      console.log('📧 User email:', currentUserData.currentUser.email);
      console.log('✅ Email verified:', currentUserData.currentUser.emailVerified);
      setUser(currentUserData.currentUser);
      setIsLoadingUserData(false);
    }
  }, [currentUserData, setUser]);

  // Track loading state when fetching user data
  useEffect(() => {
    if (appKitIsConnected && hasJwtToken && currentUserLoading) {
      setIsLoadingUserData(true);
    } else if (!currentUserLoading) {
      setIsLoadingUserData(false);
    }
  }, [appKitIsConnected, hasJwtToken, currentUserLoading]);

  // 🔍 DEBUG: Log connection state changes IMMEDIATELY
  useEffect(() => {
    console.log('🔍 Connection State Change:', {
      isConnected: appKitIsConnected,
      address: appKitAddress,
      status: status
    });
  }, [appKitIsConnected, appKitAddress, status]);

  // 🔍 DEBUG: Log Reown/AppKit data to check if email is provided
  useEffect(() => {
    console.log('🔍 Debug Effect Running - Checking conditions...');
    console.log('   isConnected:', appKitIsConnected);
    console.log('   hasAddress:', !!appKitAddress);

    if (appKitIsConnected && appKitAddress) {
      console.log('========================================');
      console.log('🔍 REOWN/APPKIT DEBUG - Connection Data');
      console.log('========================================');
      console.log('📍 Address:', appKitAddress);
      console.log('📍 CAIP Address:', caipAddress);
      console.log('📍 Connection Status:', status);
      console.log('📍 Is Connected:', appKitIsConnected);

      console.log('\n🔍 AppKit State:', appKitState);

      console.log('\n🔍 Wallet Provider:', walletProvider);

      // Check for email in various possible locations
      console.log('\n🔍 Checking for email in AppKit data...');

      // Check localStorage for AppKit auth data
      if (typeof window !== 'undefined') {
        const allStorage: Record<string, any> = {};

        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && (key.includes('@w3m') || key.includes('reown') || key.includes('appkit'))) {
            try {
              const value = window.localStorage.getItem(key);
              allStorage[key] = value ? JSON.parse(value) : value;
            } catch {
              allStorage[key] = window.localStorage.getItem(key);
            }
          }
        }

        console.log('🔍 AppKit LocalStorage Data:', allStorage);

        // Look for email in the data
        let foundEmail = null;
        for (const [key, value] of Object.entries(allStorage)) {
          if (typeof value === 'object' && value !== null) {
            if (value.email) {
              foundEmail = value.email;
              console.log(`✅ Found email in ${key}:`, foundEmail);
            }
            if (value.user?.email) {
              foundEmail = value.user.email;
              console.log(`✅ Found email in ${key}.user:`, foundEmail);
            }
            if (value.profile?.email) {
              foundEmail = value.profile.email;
              console.log(`✅ Found email in ${key}.profile:`, foundEmail);
            }
          }
        }

        if (!foundEmail) {
          console.log('⚠️ No email found in AppKit storage');
          console.log('💡 This means either:');
          console.log('   1. User connected with wallet app (Phantom/Solflare) - no email provided');
          console.log('   2. User connected with Reown social login but email not available');
          console.log('   3. Reown social login features need to be enabled in dashboard');
        }
      }

      console.log('========================================\n');
    }
  }, [appKitIsConnected, appKitAddress, caipAddress, status, appKitState, walletProvider]);

  // Track previous address to detect wallet switches
  const previousAddressRef = useRef<string | undefined>(undefined);
  const [extensionAddress, setExtensionAddress] = useState<string | undefined>(undefined);

  // Track connection timeout
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);

  // Clear auth error function
  const clearAuthError = () => setAuthError(null);

  // FORCE clear stale wallet data on mount and sync to extension
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if we have a serious mismatch on initial load
    const phantom = (window as any).phantom?.solana;
    const solflare = (window as any).solflare;
    const bitget = (window as any).bitkeep?.solana || (window as any).bitgetWallet?.solana;
    const actualAddress = phantom?.publicKey?.toString() ||
                         solflare?.publicKey?.toString() ||
                         bitget?.publicKey?.toString();

    if (actualAddress && appKitAddress && actualAddress !== appKitAddress) {
      console.warn('⚠️ MOUNT: Stale wallet address detected on initial load');
      console.log('Extension wallet:', actualAddress);
      console.log('AppKit cached:', appKitAddress);
      console.log('🧹 Clearing stale AppKit cache and syncing...');

      // Clear JWT token for old address
      window.localStorage.removeItem('jwtToken');

      // Clear stale WalletConnect/AppKit storage
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && (
          key.startsWith('wc@2:') ||
          key.startsWith('@w3m/') ||
          key.startsWith('W3M_') ||
          key.includes('reown')
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => {
        console.log('  Removing:', key);
        window.localStorage.removeItem(key);
      });

      // Force sync to extension address immediately
      setExtensionAddress(actualAddress);

      // Clear Apollo cache to refetch with new address
      window.dispatchEvent(new CustomEvent('clear-apollo-cache'));

      console.log('✅ Synced to extension address:', actualAddress);
      console.log('♻️ App will re-authenticate with correct address');
    }
  }, []); // Run once on mount

  // Local state to immediately reflect disconnect
  const isConnected = !isDisconnecting && appKitIsConnected;

  // RPC endpoint - use environment variable or default to mainnet
  const rpcEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcEndpoint, {
    commitment: 'finalized',
    confirmTransactionInitialTimeout: 60000,
  });

  // ALWAYS prioritize extension address over AppKit cache to prevent mismatches
  // Get real-time address from wallet extension (Phantom, Solflare, Bitget, etc.)
  const getExtensionAddress = () => {
    if (typeof window === 'undefined') return null;

    // Check for various wallet extensions
    const phantom = (window as any).phantom?.solana;
    const solflare = (window as any).solflare;
    const bitget = (window as any).bitkeep?.solana || (window as any).bitgetWallet?.solana;

    // Return the first connected wallet's address
    return phantom?.publicKey?.toString() ||
           solflare?.publicKey?.toString() ||
           bitget?.publicKey?.toString();
  };

  // Use extension address if available, otherwise fall back to AppKit
  const actualExtensionAddress = getExtensionAddress();
  const address = !isDisconnecting
    ? (actualExtensionAddress || extensionAddress || appKitAddress)
    : undefined;

  // DEBUG: Log address being used
  useEffect(() => {
    if (typeof window === 'undefined' || !isConnected) return;

    console.log('✅ WALLET CONNECTED:', {
      displayedAddress: address,
      source: actualExtensionAddress ? '🔌 Phantom Extension (Real-time)' :
              extensionAddress ? '💾 Extension (Cached)' :
              '📦 AppKit (Fallback)',
      appKitCached: appKitAddress,
      phantomRealtime: actualExtensionAddress,
      network: rpcEndpoint.includes('devnet') ? 'DEVNET' : rpcEndpoint.includes('testnet') ? 'TESTNET' : 'MAINNET',
      rpcEndpoint: rpcEndpoint
    });

    // Since we now use actualExtensionAddress in real-time, mismatches shouldn't happen
    // But keep this as a safeguard
    if (actualExtensionAddress && appKitAddress && actualExtensionAddress !== appKitAddress) {
      console.warn('⚠️ AppKit cache differs from Phantom extension');
      console.warn('Phantom extension:', actualExtensionAddress);
      console.warn('AppKit cached:', appKitAddress);
      console.log('✅ Using Phantom address (real-time sync active)');

      // Update cached extension address
      setExtensionAddress(actualExtensionAddress);

      // Clear old JWT token
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('jwtToken');
      }

      // Clear Apollo cache
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('clear-apollo-cache'));
      }

      console.log('✅ Address synced to:', actualExtensionAddress);
      console.log('♻️ Re-authenticating with correct address...');
    }
  }, [address, appKitAddress, actualExtensionAddress, extensionAddress, rpcEndpoint, isConnected]);

  const connect = async () => {
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      console.log('⚠️ Connection already in progress, ignoring duplicate request');
      return;
    }

    // Clear any previous timeout
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    // Clear any stale WalletConnect data that might cause publish errors
    try {
      if (typeof window !== 'undefined') {
        const keysToCheck = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && (key.startsWith('wc@2:') || key.includes('walletconnect'))) {
            keysToCheck.push(key);
          }
        }

        // If there are stale WalletConnect keys, clear them
        if (keysToCheck.length > 0) {
          console.log('🧹 Clearing stale WalletConnect data before connecting...');
          keysToCheck.forEach(key => window.localStorage.removeItem(key));
        }
      }
    } catch (e) {
      console.warn('Could not clear stale data:', e);
    }

    console.log('🔌 Starting wallet connection...');
    isConnectingRef.current = true;
    setIsConnecting(true);
    setAuthError(null);

    // Set shorter timeout to reset connecting state if modal is closed without connecting
    // Users can click "Connect Wallet" again immediately
    connectionTimeoutRef.current = setTimeout(() => {
      if (isConnectingRef.current && !appKitIsConnected) {
        console.log('⏱️ Connection cancelled or timed out - ready to retry');
        isConnectingRef.current = false;
        setIsConnecting(false);
      }
    }, 3000); // 3 second timeout - much shorter for better UX

    try {
      await open();
    } catch (error: any) {
      console.error('Error opening wallet modal:', error);

      // Handle specific WalletConnect errors
      let errorMessage = 'Failed to open wallet connection';
      if (error?.message?.includes('Failed to publish payload')) {
        errorMessage = 'Connection error. Please disconnect any existing sessions and try again.';

        // Clear all WalletConnect data
        if (typeof window !== 'undefined') {
          console.log('🧹 Clearing all WalletConnect data due to publish error...');
          const keysToRemove: string[] = [];
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key && (
              key.startsWith('wc@2:') ||
              key.startsWith('@w3m/') ||
              key.startsWith('W3M_') ||
              key.includes('walletconnect') ||
              key.includes('reown')
            )) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => window.localStorage.removeItem(key));
          console.log('✅ Cleared WalletConnect data. Please try connecting again.');
        }
      }

      setAuthError(errorMessage);
      isConnectingRef.current = false;
      setIsConnecting(false);
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    }
  };

  const disconnect = async () => {
    try {
      // Clear any authentication errors
      setAuthError(null);

      // Clear connection timeout if exists
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }

      // Reset connecting state
      isConnectingRef.current = false;
      setIsConnecting(false);

      // Immediately set disconnecting state to update UI
      setIsDisconnecting(true);

      // Clear extension address override
      setExtensionAddress(undefined);

      // Clear JWT token and user data immediately
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('jwtToken');
        window.localStorage.removeItem('jwtTokenAddress');
      }

      // Clear user context
      setUser(null);

      // Clear loading state
      setIsLoadingUserData(false);

      // 🔥 CRITICAL: Clear Apollo cache to prevent old user data from persisting
      console.log('🗑️ Clearing Apollo cache on disconnect...');
      clearApolloCache();

      // Use AppKit's official disconnect method for Solana namespace
      await modal.disconnect();

      // Close modal
      close();

      // AGGRESSIVE CACHE CLEARING - Remove ALL AppKit/WalletConnect data
      if (typeof window !== 'undefined') {
        // Small delay to ensure disconnect completes
        await new Promise(resolve => setTimeout(resolve, 100));

        console.log('🧹 Clearing all wallet connection cache...');

        // Clear localStorage
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && (
            key.startsWith('wc@2:') ||
            key.startsWith('@w3m/') ||
            key.startsWith('W3M_') ||
            key.startsWith('WALLETCONNECT_') ||
            key.includes('walletconnect') ||
            key.includes('reown') ||
            key.includes('wagmi') ||
            key.includes('connector') ||
            key.includes('appkit') ||
            key.includes('solana')
          )) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => {
          console.log('  Removing localStorage:', key);
          window.localStorage.removeItem(key);
        });

        // Clear sessionStorage
        const sessionKeysToRemove: string[] = [];
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key && (
            key.startsWith('wc@2:') ||
            key.startsWith('@w3m/') ||
            key.startsWith('W3M_') ||
            key.includes('walletconnect') ||
            key.includes('reown') ||
            key.includes('appkit') ||
            key.includes('solana')
          )) {
            sessionKeysToRemove.push(key);
          }
        }
        sessionKeysToRemove.forEach(key => {
          console.log('  Removing sessionStorage:', key);
          window.sessionStorage.removeItem(key);
        });

        console.log('✅ Wallet disconnected and all cache cleared');
      }

      // Reset disconnecting state
      setTimeout(() => {
        setIsDisconnecting(false);
      }, 300);
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      // Reset disconnecting state on error
      setIsDisconnecting(false);
    }
  };

  const signMessage = async (message: string): Promise<string | null> => {
    if (!walletProvider || !address) {
      console.error('Wallet not connected');
      return null;
    }

    try {
      const encodedMessage = new TextEncoder().encode(message);
      const signature = await walletProvider.signMessage(encodedMessage);
      return Buffer.from(signature).toString('base64');
    } catch (error) {
      console.error('Error signing message:', error);
      return null;
    }
  };

  const sendTransaction = async (to: string, amount: number, tokenSymbol: string = 'SOL'): Promise<string | null> => {
    // Delegate to appropriate method based on token type
    if (isNativeSOL(tokenSymbol)) {
      return sendSOLTransaction(to, amount);
    } else {
      return sendTokenTransaction(to, amount, tokenSymbol);
    }
  };

  const sendSOLTransaction = async (to: string, amount: number): Promise<string | null> => {
    if (!walletProvider || !address) {
      console.error('Wallet not connected');
      throw new Error('Wallet not connected');
    }

    try {
      const fromPubkey = new PublicKey(address);
      const toPubkey = new PublicKey(to);

      // Calculate lamports needed
      const lamportsToSend = Math.floor(amount * LAMPORTS_PER_SOL);
      const estimatedFee = 5000; // Approximately 0.000005 SOL for transaction fee

      // Check balance before attempting transaction
      const balance = await connection.getBalance(fromPubkey);
      console.log('Current balance:', balance / LAMPORTS_PER_SOL, 'SOL');
      console.log('Amount to send:', lamportsToSend / LAMPORTS_PER_SOL, 'SOL');
      console.log('Estimated fee:', estimatedFee / LAMPORTS_PER_SOL, 'SOL');
      console.log('Total needed:', (lamportsToSend + estimatedFee) / LAMPORTS_PER_SOL, 'SOL');

      if (balance < lamportsToSend + estimatedFee) {
        const network = rpcEndpoint.includes('devnet') ? 'devnet' : rpcEndpoint.includes('testnet') ? 'testnet' : 'mainnet';
        throw new Error(
          `Insufficient balance. You have ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL but need ${((lamportsToSend + estimatedFee) / LAMPORTS_PER_SOL).toFixed(6)} SOL (including fees). ` +
          `You are on ${network}. Get ${network} SOL from a faucet: https://faucet.solana.com`
        );
      }

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: lamportsToSend,
        })
      );

      // Get latest blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      console.log('Sending transaction...');

      // Suppress ALL console errors during wallet provider calls to prevent empty {} errors
      const originalError = console.error;
      const suppressWalletErrors = (..._args: any[]) => {
        // Suppress all errors during wallet operations
        // Wallet providers often throw empty {} objects that clutter the console
        return;
      };

      let signature: string;

      try {
        console.error = suppressWalletErrors;

        // Try approach 1: Use sendTransaction (standard Solana wallet adapter method)
        if (typeof walletProvider.sendTransaction === 'function') {
          try {
            signature = await walletProvider.sendTransaction(transaction, connection, {
              skipPreflight: false,
              preflightCommitment: 'confirmed',
            });
          } catch (sendError: any) {
            // Fallback: Try signTransaction + sendRawTransaction
            const signedTransaction = await walletProvider.signTransaction(transaction);
            const rawTransaction = signedTransaction.serialize();
            signature = await connection.sendRawTransaction(rawTransaction, {
              skipPreflight: false,
              preflightCommitment: 'confirmed',
            });
          }
        } else {
          // No sendTransaction method, try sign + send approach
          const signedTransaction = await walletProvider.signTransaction(transaction);
          const rawTransaction = signedTransaction.serialize();
          signature = await connection.sendRawTransaction(rawTransaction, {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
          });
        }
      } finally {
        // Restore original console.error
        console.error = originalError;
      }

      console.log('Transaction sent:', signature);

      // Wait for confirmation using new API
      console.log('Waiting for confirmation...');
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      });

      console.log('Transaction confirmed!');
      return signature;
    } catch (error: any) {
      // Check for user cancellation/rejection (most common case)
      const errorStr = String(error?.message || error || '').toLowerCase();
      const isCancellation =
        errorStr.includes('user rejected') ||
        errorStr.includes('user denied') ||
        errorStr.includes('user cancelled') ||
        errorStr.includes('user canceled') ||
        errorStr.includes('cancelled by user') ||
        errorStr.includes('canceled by user') ||
        errorStr.includes('rejected by user') ||
        errorStr.includes('transaction declined') ||
        errorStr.includes('signature rejected') ||
        // Empty error object is often a user cancellation in Phantom/Solflare
        (Object.keys(error || {}).length === 0);

      if (isCancellation) {
        const cancelError = new Error('USER_CANCELLED_TRANSACTION');
        (cancelError as any).code = 'USER_CANCELLED';
        throw cancelError;
      }

      // Provide more helpful error messages
      if (error.message?.includes('Insufficient balance')) {
        throw error; // Re-throw our custom balance error
      } else if (error.message?.includes('simulate') || error.message?.includes('simulation')) {
        throw new Error(
          'Transaction simulation failed. This usually means: ' +
          '1) Insufficient balance for transaction + fees, ' +
          '2) Network mismatch (wallet on different network), or ' +
          '3) Invalid transaction parameters. ' +
          'Check console for details: ' + (error.message || '')
        );
      } else if (error.message?.includes('blockhash not found') || error.message?.includes('Blockhash not found')) {
        throw new Error('Transaction expired. Please try again.');
      } else if (error.message?.includes('not connected') || !walletProvider) {
        throw new Error('Wallet not connected. Please connect your wallet and try again.');
      }

      // Handle empty error objects or other errors
      let errorMsg = 'Transaction failed. Please try again.';
      if (error.message) {
        errorMsg = error.message;
      } else if (error.toString && error.toString() !== '[object Object]') {
        errorMsg = error.toString();
      } else if (typeof error === 'string') {
        errorMsg = error;
      }

      const userError = new Error(errorMsg);
      (userError as any).isUserFacing = true;
      throw userError;
    }
  };

  const sendTokenTransaction = async (to: string, amount: number, tokenSymbol: string): Promise<string | null> => {
    if (!walletProvider || !address) {
      console.error('Wallet not connected');
      throw new Error('Wallet not connected');
    }

    try {
      const tokenConfig = getTokenConfig(tokenSymbol);
      if (!tokenConfig) {
        throw new Error(`Token ${tokenSymbol} not supported`);
      }

      const network = getNetworkFromRPC(rpcEndpoint);
      const mintAddress = getTokenMintAddress(tokenSymbol, network);
      const fromPubkey = new PublicKey(address);
      const toPubkey = new PublicKey(to);

      // Get sender's token account
      const fromTokenAccount = await getAssociatedTokenAddress(
        mintAddress,
        fromPubkey
      );

      // Get recipient's token account
      const toTokenAccount = await getAssociatedTokenAddress(
        mintAddress,
        toPubkey
      );

      // Calculate token amount (considering decimals)
      const tokenAmount = Math.floor(amount * Math.pow(10, tokenConfig.decimals));

      console.log('SPL Token Transfer Details:', {
        token: tokenSymbol,
        from: fromPubkey.toString(),
        to: toPubkey.toString(),
        amount: amount,
        tokenAmount: tokenAmount,
        decimals: tokenConfig.decimals,
        fromTokenAccount: fromTokenAccount.toString(),
        toTokenAccount: toTokenAccount.toString(),
      });

      // Check if sender has token account
      try {
        await getAccount(connection, fromTokenAccount);
      } catch (error: any) {
        if (error instanceof TokenAccountNotFoundError) {
          throw new Error(`You don't have a ${tokenSymbol} token account. Please fund your wallet with ${tokenSymbol} first.`);
        }
        throw error;
      }

      // Check token balance
      const balance = await getTokenBalance(tokenSymbol);
      if (balance === null || balance < amount) {
        throw new Error(
          `Insufficient ${tokenSymbol} balance. You have ${balance?.toFixed(tokenConfig.decimals) || 0} ${tokenSymbol} but need ${amount} ${tokenSymbol}.`
        );
      }

      const transaction = new Transaction();

      // Check if recipient has token account, if not create it
      try {
        await getAccount(connection, toTokenAccount);
      } catch (error: any) {
        if (error instanceof TokenAccountNotFoundError) {
          console.log('Recipient token account does not exist, will create it');
          // Add instruction to create associated token account
          transaction.add(
            createAssociatedTokenAccountInstruction(
              fromPubkey, // payer
              toTokenAccount, // token account to create
              toPubkey, // owner of new account
              mintAddress // mint
            )
          );
        } else {
          throw error;
        }
      }

      // Add transfer instruction
      transaction.add(
        createTransferInstruction(
          fromTokenAccount, // source
          toTokenAccount, // destination
          fromPubkey, // owner
          tokenAmount // amount (in smallest units)
        )
      );

      // Get latest blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      console.log('Sending SPL token transaction...');

      let signature: string;

      // Suppress ALL console errors during wallet provider calls to prevent empty {} errors
      const originalError = console.error;
      const suppressWalletErrors = (..._args: any[]) => {
        // Suppress all errors during wallet operations
        // Wallet providers often throw empty {} objects that clutter the console
        return;
      };

      try {
        console.error = suppressWalletErrors;

        // Try sendTransaction method first
        if (typeof walletProvider.sendTransaction === 'function') {
          try {
            signature = await walletProvider.sendTransaction(transaction, connection, {
              skipPreflight: false,
              preflightCommitment: 'confirmed',
            });
            console.log('SPL token transaction sent successfully');
          } catch (sendError: any) {
            // Fallback to sign + send
            try {
              const signedTransaction = await walletProvider.signTransaction(transaction);
              const rawTransaction = signedTransaction.serialize();
              signature = await connection.sendRawTransaction(rawTransaction, {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
              });
            } catch (fallbackError: any) {
              // Check if user cancelled during signing
              const errorStr = String(fallbackError?.message || fallbackError || '').toLowerCase();
              const isCancellation =
                errorStr.includes('user rejected') ||
                errorStr.includes('user denied') ||
                errorStr.includes('user cancelled') ||
                errorStr.includes('user canceled') ||
                errorStr.includes('cancelled by user') ||
                errorStr.includes('canceled by user') ||
                errorStr.includes('rejected by user') ||
                errorStr.includes('transaction declined') ||
                errorStr.includes('signature rejected') ||
                (Object.keys(fallbackError || {}).length === 0);

              if (isCancellation) {
                const cancelError = new Error('USER_CANCELLED_TRANSACTION');
                (cancelError as any).code = 'USER_CANCELLED';
                throw cancelError;
              }
              // Re-throw other errors to be handled by outer catch
              throw fallbackError;
            }
          }
        } else {
          // Sign and send
          const signedTransaction = await walletProvider.signTransaction(transaction);
          const rawTransaction = signedTransaction.serialize();
          signature = await connection.sendRawTransaction(rawTransaction, {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
          });
        }
      } finally {
        // Restore original console.error
        console.error = originalError;
      }

      console.log('SPL token transaction sent:', signature);

      // Wait for confirmation
      console.log('Waiting for confirmation...');
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      });

      console.log('SPL token transaction confirmed!');
      return signature;
    } catch (error: any) {
      // Check for user cancellation/rejection (most common case)
      const errorStr = String(error?.message || error || '').toLowerCase();
      const isCancellation =
        errorStr.includes('user rejected') ||
        errorStr.includes('user denied') ||
        errorStr.includes('user cancelled') ||
        errorStr.includes('user canceled') ||
        errorStr.includes('cancelled by user') ||
        errorStr.includes('canceled by user') ||
        errorStr.includes('rejected by user') ||
        errorStr.includes('transaction declined') ||
        errorStr.includes('signature rejected') ||
        // Empty error object is often a user cancellation in Phantom/Solflare
        (Object.keys(error || {}).length === 0);

      if (isCancellation) {
        const cancelError = new Error('USER_CANCELLED_TRANSACTION');
        (cancelError as any).code = 'USER_CANCELLED';
        throw cancelError;
      }

      // Provide helpful error messages
      if (error.message?.includes('Insufficient')) {
        throw error; // Re-throw our custom balance error
      } else if (error.message?.includes('token account')) {
        throw error; // Re-throw token account errors
      }

      // Handle empty error objects
      let errorMsg = 'Payment failed. Please check your balance and try again.';
      if (error.message) {
        errorMsg = error.message;
      } else if (error.toString && error.toString() !== '[object Object]') {
        errorMsg = error.toString();
      } else if (typeof error === 'string') {
        errorMsg = error;
      }

      const userError = new Error(errorMsg);
      (userError as any).isUserFacing = true;
      throw userError;
    }
  };

  const getBalance = async (tokenSymbol: string = 'SOL'): Promise<number | null> => {
    if (isNativeSOL(tokenSymbol)) {
      return getSOLBalance();
    } else {
      return getTokenBalance(tokenSymbol);
    }
  };

  const getSOLBalance = async (): Promise<number | null> => {
    if (!address) return null;

    try {
      const pubkey = new PublicKey(address);
      const balance = await connection.getBalance(pubkey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Error getting SOL balance:', error);
      return null;
    }
  };

  const getTokenBalance = async (tokenSymbol: string): Promise<number | null> => {
    console.log(`💰 getTokenBalance called for ${tokenSymbol}, address:`, address);

    if (!address) {
      console.warn('⚠️ No address available for token balance check');
      return null;
    }

    try {
      const tokenConfig = getTokenConfig(tokenSymbol);
      if (!tokenConfig) {
        console.error(`Token ${tokenSymbol} not supported`);
        return null;
      }

      const network = getNetworkFromRPC(rpcEndpoint);
      const mintAddress = getTokenMintAddress(tokenSymbol, network);
      const pubkey = new PublicKey(address);

      console.log(`🔍 Checking ${tokenSymbol} balance:`, {
        address: address,
        network: network,
        mintAddress: mintAddress.toString()
      });

      // Get associated token account address
      const tokenAccount = await getAssociatedTokenAddress(
        mintAddress,
        pubkey
      );

      try {
        const accountInfo = await getAccount(connection, tokenAccount);
        const balance = Number(accountInfo.amount) / Math.pow(10, tokenConfig.decimals);
        return balance;
      } catch (error: any) {
        if (error instanceof TokenAccountNotFoundError) {
          // Token account doesn't exist, balance is 0
          return 0;
        }
        throw error;
      }
    } catch (error) {
      console.error(`Error getting ${tokenSymbol} balance:`, error);
      return null;
    }
  };

  const openModal = () => open();
  const closeModal = () => close();

  // Listen for clear-apollo-cache event
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleClearCache = () => {
      console.log('🗑️ Clear cache event received - resetting Apollo cache');
      clearApolloCache();
    };

    window.addEventListener('clear-apollo-cache', handleClearCache);
    return () => window.removeEventListener('clear-apollo-cache', handleClearCache);
  }, []);

  // Listen for Phantom/Solflare wallet extension account changes
  useEffect(() => {
    if (typeof window === 'undefined' || !isConnected) return;

    const handleAccountChange = (publicKey: any) => {
      console.log('🔄 Wallet extension account changed event detected');
      console.log('Event payload:', publicKey);
      console.log('Type of payload:', typeof publicKey);

      // Handle different event payload formats
      let newAddress: string | undefined;

      if (publicKey === null || publicKey === undefined) {
        console.log('Account disconnected or null payload received');
        return; // Ignore disconnect events
      } else if (typeof publicKey === 'string') {
        newAddress = publicKey;
      } else if (publicKey?.toString && typeof publicKey.toString === 'function') {
        newAddress = publicKey.toString();
      } else if (publicKey?.toBase58 && typeof publicKey.toBase58 === 'function') {
        newAddress = publicKey.toBase58();
      }

      console.log('Parsed new address from extension:', newAddress);
      console.log('Current AppKit address:', appKitAddress);
      console.log('Current extension address override:', extensionAddress);
      console.log('Current effective address:', address);

      if (newAddress) {
        const currentEffectiveAddress = extensionAddress || appKitAddress;

        if (newAddress !== currentEffectiveAddress) {
          console.log('⚠️ Address change detected!');
          console.log('Previous:', currentEffectiveAddress);
          console.log('New:', newAddress);

          // Update extension address immediately so UI shows new address
          setExtensionAddress(newAddress);

          // Clear old JWT token
          window.localStorage.removeItem('jwtToken');
          console.log('Cleared old JWT token for extension wallet switch');

          // Delay the wallet-switched event to allow authentication to start
          setTimeout(() => {
            // Also dispatch a clear-cache event to force Apollo to refetch
            window.dispatchEvent(new CustomEvent('clear-apollo-cache'));

            window.dispatchEvent(new CustomEvent('wallet-switched', {
              detail: {
                previousAddress: currentEffectiveAddress,
                newAddress: newAddress
              }
            }));
            console.log('✅ Dispatched wallet-switched event');
          }, 300); // Reduced - components will poll for auth completion

          console.log('✅ Extension address updated in UI');
        } else {
          console.log('ℹ️ Same address, no change needed');
        }
      }
    };

    // Listen to Phantom wallet (try multiple event names)
    const phantom = (window as any).phantom?.solana;
    if (phantom) {
      try {
        console.log('✅ Phantom wallet detected');
        console.log('Phantom current publicKey:', phantom.publicKey?.toString());
        console.log('Phantom isConnected:', phantom.isConnected);

        if (typeof phantom.on === 'function') {
          // Try 'accountChanged' (standard)
          phantom.on('accountChanged', handleAccountChange);
          console.log('✅ Phantom accountChanged listener added');

          // Also try 'accountsChanged' (alternative)
          phantom.on('accountsChanged', handleAccountChange);
          console.log('✅ Phantom accountsChanged listener added');
        } else {
          console.log('⚠️ Phantom does not support .on() method, will rely on polling');
        }
      } catch (error) {
        console.log('⚠️ Could not add Phantom listener (will use polling):', error);
      }
    } else {
      console.log('ℹ️ Phantom wallet not detected in window');
    }

    // Listen to Solflare wallet
    const solflare = (window as any).solflare;
    if (solflare) {
      try {
        console.log('✅ Solflare wallet detected - adding account change listener');
        if (typeof solflare.on === 'function') {
          solflare.on('accountChanged', handleAccountChange);
          console.log('Solflare accountChanged listener added successfully');
        }
      } catch (error) {
        console.log('Could not add Solflare listener (this is OK, will use polling)');
      }
    }

    // Also listen to walletProvider changes if available
    if (walletProvider) {
      console.log('✅ Wallet provider detected - checking for event listeners');

      // Some wallet providers expose an 'on' method for events
      try {
        if (typeof (walletProvider as any).on === 'function') {
          (walletProvider as any).on('accountChanged', handleAccountChange);
          console.log('Added accountChanged listener to walletProvider');
        }
      } catch (error) {
        // Some wallet providers may not properly support the 'on' method
        console.log('WalletProvider does not support accountChanged event listener (this is OK)');
      }
    }

    // Cleanup listeners
    return () => {
      try {
        if (phantom && typeof phantom.removeListener === 'function') {
          phantom.removeListener('accountChanged', handleAccountChange);
          phantom.removeListener('accountsChanged', handleAccountChange);
          console.log('Removed Phantom listeners');
        }
      } catch (e) {
        // Ignore cleanup errors
      }

      try {
        if (solflare && typeof solflare.removeListener === 'function') {
          solflare.removeListener('accountChanged', handleAccountChange);
          solflare.removeListener('accountsChanged', handleAccountChange);
          console.log('Removed Solflare listeners');
        }
      } catch (e) {
        // Ignore cleanup errors
      }

      try {
        if (walletProvider && typeof (walletProvider as any).removeListener === 'function') {
          (walletProvider as any).removeListener('accountChanged', handleAccountChange);
          console.log('Removed walletProvider listener');
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, [appKitAddress, isConnected, walletProvider]);

  // Periodically check if wallet extension address matches current effective address
  useEffect(() => {
    if (typeof window === 'undefined' || !isConnected) return;

    let checkCount = 0;
    const checkAddressSync = () => {
      checkCount++;
      const currentEffectiveAddress = extensionAddress || appKitAddress;

      // Log every 10th check (every 10 seconds) to avoid spam
      if (checkCount % 10 === 1) {
        console.log('🔍 Polling check #' + checkCount + ' - Current address:', currentEffectiveAddress);
      }

      if (!currentEffectiveAddress) {
        console.log('⚠️ No current address available for sync check');
        return;
      }

      // Check Phantom
      const phantom = (window as any).phantom?.solana;
      if (phantom?.isConnected && phantom.publicKey) {
        const phantomAddress = phantom.publicKey.toString();

        // Log detailed info on every check for debugging
        if (checkCount <= 5 || phantomAddress !== currentEffectiveAddress) {
          console.log('Phantom check:', {
            phantomAddress,
            currentEffectiveAddress,
            match: phantomAddress === currentEffectiveAddress
          });
        }

        if (phantomAddress !== currentEffectiveAddress) {
          console.warn('⚠️ Address mismatch detected (syncing to Phantom)');
          console.log('Phantom wallet:', phantomAddress);
          console.log('App was using:', currentEffectiveAddress);
          console.log('🔧 Syncing to Phantom address...');

          // Update extension address
          setExtensionAddress(phantomAddress);

          // Clear JWT first
          window.localStorage.removeItem('jwtToken');
          console.log('Cleared old JWT token');

          // Delay the wallet-switched event to allow authentication to start
          setTimeout(() => {
            // Also dispatch a clear-cache event to force Apollo to refetch
            window.dispatchEvent(new CustomEvent('clear-apollo-cache'));

            window.dispatchEvent(new CustomEvent('wallet-switched', {
              detail: {
                previousAddress: currentEffectiveAddress,
                newAddress: phantomAddress
              }
            }));
            console.log('✅ Dispatched wallet-switched event');
          }, 300); // Reduced - components will poll for auth completion

          console.log('✅ Synced to Phantom address:', phantomAddress);
        } else if (extensionAddress && phantomAddress === appKitAddress) {
          // Extension and AppKit are back in sync, clear extensionAddress override
          console.log('✅ Phantom and AppKit are in sync, clearing override');
          setExtensionAddress(undefined);
        }
      } else {
        if (checkCount <= 3) {
          console.log('ℹ️ Phantom not connected or no publicKey');
        }
      }

      // Check Solflare
      const solflare = (window as any).solflare;
      if (solflare?.isConnected && solflare.publicKey) {
        const solflareAddress = solflare.publicKey.toString();
        if (solflareAddress !== currentEffectiveAddress) {
          console.warn('⚠️ Address mismatch detected (syncing to Solflare)');
          console.log('Solflare wallet:', solflareAddress);
          console.log('App was using:', currentEffectiveAddress);
          console.log('🔧 Syncing to Solflare address...');

          // Update extension address
          setExtensionAddress(solflareAddress);

          // Clear JWT first
          window.localStorage.removeItem('jwtToken');
          console.log('Cleared old JWT token');

          // Delay the wallet-switched event to allow authentication to start
          setTimeout(() => {
            // Also dispatch a clear-cache event to force Apollo to refetch
            window.dispatchEvent(new CustomEvent('clear-apollo-cache'));

            window.dispatchEvent(new CustomEvent('wallet-switched', {
              detail: {
                previousAddress: currentEffectiveAddress,
                newAddress: solflareAddress
              }
            }));
            console.log('✅ Dispatched wallet-switched event');
          }, 300); // Reduced - components will poll for auth completion

          console.log('✅ Synced to Solflare address');
        } else if (extensionAddress && solflareAddress === appKitAddress) {
          // Extension and AppKit are back in sync, clear extensionAddress override
          console.log('✅ Solflare and AppKit are in sync, using AppKit address');
          setExtensionAddress(undefined);
        }
      }
    };

    // Check immediately
    console.log('🚀 Starting wallet address sync polling');
    checkAddressSync();

    // Then check every 1 second (faster polling for better responsiveness)
    const syncInterval = setInterval(checkAddressSync, 1000);

    return () => {
      console.log('🛑 Stopping wallet address sync polling');
      clearInterval(syncInterval);
    };
  }, [isConnected, appKitAddress, extensionAddress]);

  // Detect wallet address changes (user switching wallets via modal)
  useEffect(() => {
    const previousAddress = previousAddressRef.current;
    const currentAddress = appKitAddress;

    // If address changed (and it's not just initial mount)
    if (previousAddress !== undefined && previousAddress !== currentAddress) {
      console.log('🔄 Wallet address changed!');
      console.log('Previous address:', previousAddress);
      console.log('New address:', currentAddress);

      // Clear old JWT token when switching wallets
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('jwtToken');
        console.log('Cleared old JWT token for wallet switch');

        // Wait for authentication to start
        setTimeout(() => {
          // Clear Apollo cache
          window.dispatchEvent(new CustomEvent('clear-apollo-cache'));

          // Dispatch custom event to notify all components
          window.dispatchEvent(new CustomEvent('wallet-switched', {
            detail: {
              previousAddress,
              newAddress: currentAddress
            }
          }));
          console.log('✅ Dispatched wallet-switched event for modal switch');
        }, 300); // Reduced - components will poll for auth completion
      }

    }

    // Update previous address ref
    previousAddressRef.current = currentAddress;
  }, [appKitAddress]);

  // Update connecting state when connection succeeds or modal is closed
  useEffect(() => {
    if (appKitIsConnected) {
      console.log('✅ Wallet connected successfully');
      isConnectingRef.current = false;
      setIsConnecting(false);

      // Clear connection timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    }
  }, [appKitIsConnected]);

  // Reset disconnecting state when AppKit confirms disconnect
  useEffect(() => {
    if (!appKitIsConnected && isDisconnecting) {
      setIsDisconnecting(false);
    }
  }, [appKitIsConnected, isDisconnecting]);

  // Cleanup connection timeout on unmount
  useEffect(() => {
    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    };
  }, []);

  // Detect when user closes modal without connecting (connection declined)
  useEffect(() => {
    // If we were connecting but are no longer, and the wallet didn't connect
    if (isConnectingRef.current && !appKitIsConnected && !isDisconnecting) {
      const checkTimer = setTimeout(() => {
        if (isConnectingRef.current && !appKitIsConnected) {
          console.log('⚠️ Connection likely declined or modal closed');
          isConnectingRef.current = false;
          setIsConnecting(false);

          // Clear timeout
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
        }
      }, 1000); // Check after 1 second delay

      return () => clearTimeout(checkTimer);
    }
  }, [appKitIsConnected, isDisconnecting]);

  // Authenticate wallet with backend when connected or when wallet changes
  useEffect(() => {
    const authenticateWithBackend = async () => {
      // Use the effective address (extension override or AppKit)
      const effectiveAddress = extensionAddress || appKitAddress;

      if (!appKitIsConnected || !effectiveAddress) {
        // Clear JWT token and user data when wallet disconnects
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('jwtToken');
        }
        setUser(null);
        return;
      }

      // 🛡️ CRITICAL: Don't re-authenticate if we already have a valid JWT for this address
      const existingToken = typeof window !== 'undefined' ? window.localStorage.getItem('jwtToken') : null;
      const tokenAddress = typeof window !== 'undefined' ? window.localStorage.getItem('jwtTokenAddress') : null;

      if (existingToken && tokenAddress === effectiveAddress) {
        console.log('✅ Already authenticated with this address, skipping re-authentication');
        console.log('📊 User data will be fetched automatically by useCurrentUserQuery');
        return;
      }

      try {
        console.log('🔐 Authenticating wallet:', effectiveAddress);
        if (extensionAddress) {
          console.log('Using extension address (overriding AppKit)');
        }

        // Set loading state while authenticating
        setIsLoadingUserData(true);

        // 📧 Use the memoized socialEmail from embeddedWalletInfo
        console.log('========================================');
        console.log('📧 EMAIL DETECTION');
        console.log('========================================');

        if (socialEmail) {
          console.log('✅ EMAIL DETECTED:', socialEmail);
          console.log('📤 Will send to backend:', socialEmail);
        } else {
          console.log('❌ NO EMAIL DETECTED');
          console.log('ℹ️ Possible reasons:');
          console.log('   1. User connected with wallet app (Phantom/Solflare) - no email provided');
          console.log('   2. User connected with Reown but didn\'t use social login');
          console.log('   3. Reown Authentication not enabled in dashboard');
        }
        console.log('========================================\n');

        // 🔐 Simple authentication with wallet address and email (no signature required)
        console.log('✅ Authenticating with wallet address and email (no signature)');

        const result = await authenticateWallet({
          variables: {
            walletAddress: effectiveAddress,
            message: null,           // ← No message signing
            signature: null,         // ← No signature required
            email: socialEmail,      // ← Email from OAuth
          },
        });

        if (result.data?.authenticateWallet?.token) {
          const token = result.data.authenticateWallet.token;
          const userData = result.data.authenticateWallet.user;

          // Store JWT token in localStorage
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('jwtToken', token);
            window.localStorage.setItem('jwtTokenAddress', effectiveAddress);
            console.log('✅ Wallet authenticated successfully, JWT token stored');
            console.log('Current wallet address:', effectiveAddress);

            if (socialEmail) {
              console.log('✅ Email sent to backend:', socialEmail);
              console.log('💡 Backend should save email automatically');
            }
          }

          // Update user context with the returned user data (includes email)
          if (userData) {
            console.log('✅ Updating user context with authenticated user data');
            console.log('📧 User email from backend:', userData.email);
            setUser(userData);

            // Also trigger a refetch to ensure we have the latest data
            setTimeout(() => {
              console.log('🔄 Refetching current user to ensure data is up-to-date');
              refetchCurrentUser();
            }, 500);
          }

          // Clear any previous auth errors on successful authentication
          setAuthError(null);
        } else if (result.data?.authenticateWallet?.errors && result.data.authenticateWallet.errors.length > 0) {
          const errorMessage = result.data.authenticateWallet.errors.join(', ');
          console.error('❌ Authentication failed:', errorMessage);
          setAuthError(errorMessage);
          setIsLoadingUserData(false);

          // Show error notification to user
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('show-notification', {
              detail: {
                type: 'error',
                message: `❌ Authentication failed: ${errorMessage}`
              }
            }));
          }
        }
      } catch (error) {
        console.error('❌ Error authenticating wallet:', error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown authentication error';
        setAuthError(errorMsg);
        setIsLoadingUserData(false);

        // Show error notification to user
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('show-notification', {
            detail: {
              type: 'error',
              message: `❌ Authentication error: ${errorMsg}`
            }
          }));
        }
      }
    };

    authenticateWithBackend();
  }, [appKitIsConnected, appKitAddress, extensionAddress, authenticateWallet]);

  // NOTE: Email is now sent directly during wallet authentication (see authenticateWallet above)
  // No need for separate email linking useEffect anymore

  const value: WalletContextType = {
    isConnected,
    address,
    isConnecting,
    isLoadingUserData,
    connect,
    disconnect,
    signMessage,
    sendTransaction,
    getBalance,
    getTokenBalance,
    sendTokenTransaction,
    openModal,
    closeModal,
    authError,
    clearAuthError,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
