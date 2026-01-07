import { PublicKey } from "@solana/web3.js";

// Staking Program Configuration
export const STAKING_PROGRAM_ID = new PublicKey(
  "Bmtrb34ikPyAwdsobDBpiJWhRjh5adZWaRQ8kV9qDJ3d"
);

// KOHAI Token Mint Address (Update this with your actual KOHAI token mint)
// For devnet, you'll need to provide the correct mint address
// Using a dummy valid address for development (Solana System Program as placeholder)
export const KOHAI_TOKEN_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_KOHAI_TOKEN_MINT ||
    "11111111111111111111111111111111" // Placeholder - replace with actual KOHAI token mint
);

// RPC Configuration
// Staking always uses Devnet since the program is deployed on Devnet
export const SOLANA_RPC_ENDPOINT = "https://api.devnet.solana.com";

// Staking Pool Seeds
export const STAKING_POOL_SEED = "staking_pool";
export const USER_STAKE_SEED = "user_stake";
export const REWARD_VAULT_SEED = "reward_vault";
export const STAKE_VAULT_SEED = "stake_vault";
