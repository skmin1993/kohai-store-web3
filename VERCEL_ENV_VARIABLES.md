# Required Vercel Environment Variables

Copy and paste these into your Vercel project settings (Settings → Environment Variables):

## Critical Build Variables
```
NEXT_PUBLIC_KOHAI_TOKEN_MINT=DMsRoBdceFeHqJ4dKVvGAmKML1Zet7XsH9U4UqNL35ov
```

## Backend & GraphQL
```
NEXT_PUBLIC_STORE_ID=8
NEXT_PUBLIC_DOMAIN=https://kohai-game-web3.onrender.com
NEXT_PUBLIC_GRAPHQL_URL=https://kohai-game-web3.onrender.com/graphql
NEXT_PUBLIC_STORE_NAME=Kohai Game Credit
```

## Wallet & Blockchain
```
NEXT_PUBLIC_REOWN_PROJECT_ID=3640df604b8bb5d05ba846326433772c
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
```

## Merchant Wallets (Multi-Chain USDT)
```
NEXT_PUBLIC_MERCHANT_WALLET_SOL=Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
NEXT_PUBLIC_MERCHANT_WALLET=Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
NEXT_PUBLIC_MERCHANT_WALLET_ETH=0x1367159AF03a8EF27497e58E10B4138bB4202cdf
NEXT_PUBLIC_MERCHANT_WALLET_BNB=0x1367159AF03a8EF27497e58E10B4138bB4202cdf
NEXT_PUBLIC_MERCHANT_WALLET_AVAX=0x1367159AF03a8EF27497e58E10B4138bB4202cdf
NEXT_PUBLIC_MERCHANT_WALLET_TRON=TQ9ZnmQdeQcmR39JiinbctJ2BiFMrHeyYQ
```

## Staking Configuration (LIVE ON DEVNET)
```
NEXT_PUBLIC_STAKING_POOL=3eQnPudPXBuXMwgwY1U2VK5Fc8jdji5s9dDttg1bvCuN
NEXT_PUBLIC_PROGRAM_ID=Bmtrb34ikPyAwdsobDBpiJWhRjh5adZWaRQ8kV9qDJ3d
NEXT_PUBLIC_REWARD_VAULT=APf8QxPo2tVu2uce9VZu7krAwDBJiZJQ8e7kuhFdEous
NEXT_PUBLIC_STAKE_VAULT=23ynYjbn96BeiUCndbaPDhVcv68M5u8qJehtZtcwZHNn
```

---

## How to Add in Vercel:

1. Go to your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Add each variable above
4. Select **Production**, **Preview**, and **Development** for each
5. Click **Save**
6. Redeploy your project

---

## Notes:

- **IMPORTANT**: Currently using DEVNET for staking. When ready for production, change:
  - `NEXT_PUBLIC_SOLANA_RPC` to mainnet RPC
  - Update all staking addresses to mainnet versions

- The Meld.io variables are optional (commented out in .env.local) and not needed if using Reown on-ramp
