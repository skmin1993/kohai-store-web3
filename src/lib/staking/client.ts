import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import BN from "bn.js";
import idl from "../idl/kohai_staking.json";
import type { KohaiStaking } from "../idl/kohai_staking";
import {
  STAKING_PROGRAM_ID,
  KOHAI_TOKEN_MINT,
  STAKING_POOL_SEED,
  USER_STAKE_SEED,
  REWARD_VAULT_SEED,
  STAKE_VAULT_SEED,
} from "./config";
import type { StakingPool, UserStake, StakingStats } from "./types";

export class StakingClient {
  program: Program<KohaiStaking>;
  connection: Connection;
  provider: AnchorProvider;

  constructor(provider: AnchorProvider) {
    this.provider = provider;
    this.connection = provider.connection;
    this.program = new Program(idl as unknown as KohaiStaking, provider);
  }

  // Get PDA addresses
  async getStakingPoolAddress(
    tokenMint: PublicKey = KOHAI_TOKEN_MINT
  ): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(STAKING_POOL_SEED), tokenMint.toBuffer()],
      STAKING_PROGRAM_ID
    );
  }

  async getUserStakeAddress(
    stakingPool: PublicKey,
    user: PublicKey
  ): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(USER_STAKE_SEED), stakingPool.toBuffer(), user.toBuffer()],
      STAKING_PROGRAM_ID
    );
  }

  async getRewardVaultAddress(
    stakingPool: PublicKey
  ): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(REWARD_VAULT_SEED), stakingPool.toBuffer()],
      STAKING_PROGRAM_ID
    );
  }

  async getStakeVaultAddress(
    stakingPool: PublicKey
  ): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(STAKE_VAULT_SEED), stakingPool.toBuffer()],
      STAKING_PROGRAM_ID
    );
  }

  // Fetch staking pool data
  async getStakingPool(tokenMint: PublicKey = KOHAI_TOKEN_MINT): Promise<StakingPool | null> {
    try {
      const [stakingPoolAddress] = await this.getStakingPoolAddress(tokenMint);
      const poolData = await this.program.account.stakingPool.fetch(
        stakingPoolAddress
      );
      return poolData as StakingPool;
    } catch (error) {
      console.error("Error fetching staking pool:", error);
      return null;
    }
  }

  // Fetch user stake data
  async getUserStake(user: PublicKey, tokenMint: PublicKey = KOHAI_TOKEN_MINT): Promise<UserStake | null> {
    try {
      const [stakingPoolAddress] = await this.getStakingPoolAddress(tokenMint);
      const [userStakeAddress] = await this.getUserStakeAddress(
        stakingPoolAddress,
        user
      );
      const stakeData = await this.program.account.userStake.fetch(
        userStakeAddress
      );
      return stakeData as UserStake;
    } catch (error) {
      console.error("Error fetching user stake:", error);
      return null;
    }
  }

  // Calculate pending rewards
  calculatePendingRewards(
    userStake: UserStake,
    stakingPool: StakingPool
  ): number {
    const now = Math.floor(Date.now() / 1000);
    const stakeDuration = now - userStake.stakeTimestamp.toNumber();
    const poolDuration =
      stakingPool.endTime.toNumber() - stakingPool.startTime.toNumber();

    if (stakeDuration <= 0 || poolDuration <= 0) return 0;

    const userShare = userStake.amount.toNumber() / stakingPool.totalStaked.toNumber();
    const totalRewards = stakingPool.totalRewardAmount.toNumber();
    const earnedRewards = userShare * totalRewards * (stakeDuration / poolDuration);

    return Math.max(0, earnedRewards - userStake.rewardDebt.toNumber());
  }

  // Get staking statistics
  async getStakingStats(user: PublicKey, tokenMint: PublicKey = KOHAI_TOKEN_MINT): Promise<StakingStats | null> {
    try {
      const stakingPool = await this.getStakingPool(tokenMint);
      const userStake = await this.getUserStake(user, tokenMint);

      if (!stakingPool) {
        return null;
      }

      const totalStaked = stakingPool.totalStaked.toNumber() / 1e9; // Assuming 9 decimals
      const userStaked = userStake ? userStake.amount.toNumber() / 1e9 : 0;
      const pendingRewards = userStake
        ? this.calculatePendingRewards(userStake, stakingPool) / 1e9
        : 0;

      const poolDuration =
        stakingPool.endTime.toNumber() - stakingPool.startTime.toNumber();
      const totalRewardTokens = stakingPool.totalRewardAmount.toNumber() / 1e6; // Convert to token units (6 decimals)
      const totalStakedForApy = stakingPool.totalStaked.toNumber() / 1e6; // Use same decimals
      const apy =
        totalStakedForApy > 0
          ? ((totalRewardTokens / totalStakedForApy) *
              (365 * 24 * 60 * 60)) /
            poolDuration
          : 0;

      const now = Math.floor(Date.now() / 1000);
      const unlockTime = userStake
        ? userStake.stakeTimestamp.toNumber() +
          stakingPool.lockPeriodSeconds.toNumber()
        : now;
      const canUnstake = now >= unlockTime;
      const timeUntilUnlock = Math.max(0, unlockTime - now);

      return {
        totalStaked,
        userStaked,
        pendingRewards,
        apy,
        lockPeriod: stakingPool.lockPeriodSeconds.toNumber(),
        canUnstake,
        timeUntilUnlock,
      };
    } catch (error) {
      console.error("Error getting staking stats:", error);
      return null;
    }
  }

  // Stake tokens
  async stake(amount: number, tokenMint: PublicKey = KOHAI_TOKEN_MINT) {
    const user = this.provider.publicKey;
    if (!user) throw new Error("Wallet not connected");

    try {
      // Get PDAs
      const [stakingPoolAddress] = await this.getStakingPoolAddress(tokenMint);
      const [userStakeAddress] = await this.getUserStakeAddress(
        stakingPoolAddress,
        user
      );
      const [stakeVaultAddress] = await this.getStakeVaultAddress(
        stakingPoolAddress
      );

      // Check if staking pool exists
      const poolInfo = await this.connection.getAccountInfo(stakingPoolAddress);
      if (!poolInfo) {
        throw new Error(
          "Staking pool not found. Please initialize the pool first."
        );
      }

      // Get user's token account
      const userTokenAccount = await getAssociatedTokenAddress(tokenMint, user);

      // Check if user's token account exists
      try {
        const tokenAccountInfo = await this.connection.getAccountInfo(
          userTokenAccount
        );
        if (!tokenAccountInfo) {
          throw new Error(
            `You don't have a KOHAI token account. Please get some KOHAI tokens first.`
          );
        }

        // Check token balance
        const tokenAccount = await getAccount(
          this.connection,
          userTokenAccount
        );
        const balance = Number(tokenAccount.amount) / 1e9;

        if (balance < amount) {
          throw new Error(
            `Insufficient balance. You have ${balance.toFixed(2)} KOHAI but trying to stake ${amount} KOHAI.`
          );
        }
      } catch (err: any) {
        if (err.message.includes("Insufficient balance")) {
          throw err;
        }
        throw new Error(
          `KOHAI token account not found. Please ensure you have KOHAI tokens in your wallet.`
        );
      }

      const amountBN = new BN(amount * 1e9); // Assuming 9 decimals

      console.log("Staking transaction details:", {
        stakingPool: stakingPoolAddress.toBase58(),
        userStake: userStakeAddress.toBase58(),
        user: user.toBase58(),
        userTokenAccount: userTokenAccount.toBase58(),
        stakeVault: stakeVaultAddress.toBase58(),
        amount: amount,
        amountBN: amountBN.toString(),
      });

      return await this.program.methods
        .stake(amountBN)
        .accounts({
          stakingPool: stakingPoolAddress,
          userStake: userStakeAddress,
          user: user,
          userTokenAccount: userTokenAccount,
          stakeVault: stakeVaultAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();
    } catch (error: any) {
      console.error("Stake error details:", error);

      // Parse Anchor/Solana errors
      if (error.message) {
        throw new Error(error.message);
      } else if (error.logs) {
        console.error("Transaction logs:", error.logs);
        throw new Error(
          `Transaction failed. Check console for details. Error: ${error.toString()}`
        );
      }

      throw error;
    }
  }

  // Unstake tokens
  async unstake(amount: number, tokenMint: PublicKey = KOHAI_TOKEN_MINT) {
    const user = this.provider.publicKey;
    if (!user) throw new Error("Wallet not connected");

    const [stakingPoolAddress] = await this.getStakingPoolAddress(tokenMint);
    const [userStakeAddress] = await this.getUserStakeAddress(
      stakingPoolAddress,
      user
    );
    const [stakeVaultAddress] = await this.getStakeVaultAddress(
      stakingPoolAddress
    );

    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, user);

    const amountBN = new BN(amount * 1e9); // Assuming 9 decimals

    return await this.program.methods
      .unstake(amountBN)
      .accounts({
        stakingPool: stakingPoolAddress,
        userStake: userStakeAddress,
        user: user,
        userTokenAccount: userTokenAccount,
        stakeVault: stakeVaultAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .rpc();
  }

  // Claim rewards
  async claimRewards(tokenMint: PublicKey = KOHAI_TOKEN_MINT) {
    const user = this.provider.publicKey;
    if (!user) throw new Error("Wallet not connected");

    const [stakingPoolAddress] = await this.getStakingPoolAddress(tokenMint);
    const [userStakeAddress] = await this.getUserStakeAddress(
      stakingPoolAddress,
      user
    );
    const [rewardVaultAddress] = await this.getRewardVaultAddress(
      stakingPoolAddress
    );

    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, user);

    return await this.program.methods
      .claimRewards()
      .accounts({
        stakingPool: stakingPoolAddress,
        userStake: userStakeAddress,
        user: user,
        userTokenAccount: userTokenAccount,
        rewardVault: rewardVaultAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .rpc();
  }
}
