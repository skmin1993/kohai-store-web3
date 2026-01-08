import { PublicKey } from '@solana/web3.js';

export interface TokenConfig {
  symbol: string;
  name: string;
  decimals: number;
  mintAddress: {
    mainnet: string;
    devnet: string;
    testnet?: string;
  };
  coingeckoId?: string;
}

export const SUPPORTED_TOKENS: Record<string, TokenConfig> = {
  SOL: {
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    mintAddress: {
      mainnet: 'So11111111111111111111111111111111111111112', // Native SOL wrapped
      devnet: 'So11111111111111111111111111111111111111112',
    },
    coingeckoId: 'solana',
  },
  USDT: {
    symbol: 'USDT',
    name: 'USD Tether',
    decimals: 6,
    mintAddress: {
      // Mainnet USDT (Official Tether)
      mainnet: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      // Devnet USDT (Your test token - you have mint authority)
      devnet: '8SSrHLnm9JgekqVE5zvTmv3MKxwXUFVd6YaiUJ6JcAPq',
    },
    coingeckoId: 'tether',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    mintAddress: {
      // Mainnet USDC (Circle)
      mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      // Devnet USDC
      devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    },
    coingeckoId: 'usd-coin',
  },
  KOHAI: {
    symbol: 'KOHAI',
    name: 'Kohai Token',
    decimals: parseInt(process.env.NEXT_PUBLIC_KOHAI_TOKEN_DECIMALS || '6'),
    mintAddress: {
      // Read from environment variables for security
      mainnet: process.env.NEXT_PUBLIC_KOHAI_TOKEN_MINT_MAINNET || '',
      devnet: process.env.NEXT_PUBLIC_KOHAI_TOKEN_MINT_DEVNET || '',
    },
  },
};

/**
 * Get token configuration by symbol
 */
export function getTokenConfig(symbol: string): TokenConfig | undefined {
  return SUPPORTED_TOKENS[symbol.toUpperCase()];
}

/**
 * Get token mint address for current network
 */
export function getTokenMintAddress(symbol: string, network: 'mainnet' | 'devnet' | 'testnet' = 'devnet'): PublicKey {
  const token = getTokenConfig(symbol);
  if (!token) {
    throw new Error(`Token ${symbol} not supported`);
  }

  const mintAddress = token.mintAddress[network];
  if (!mintAddress) {
    throw new Error(`Token ${symbol} not available on ${network}`);
  }

  return new PublicKey(mintAddress);
}

/**
 * Check if symbol is native SOL
 */
export function isNativeSOL(symbol: string): boolean {
  return symbol.toUpperCase() === 'SOL';
}

/**
 * Get current network from RPC endpoint
 */
export function getNetworkFromRPC(rpcEndpoint: string): 'mainnet' | 'devnet' | 'testnet' {
  if (rpcEndpoint.includes('mainnet')) return 'mainnet';
  if (rpcEndpoint.includes('testnet')) return 'testnet';
  return 'devnet';
}
