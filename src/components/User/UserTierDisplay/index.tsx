"use client";

import React from "react";
import TierBadge from "../TierBadge";
import styles from "./UserTierDisplay.module.css";

interface UserTierDisplayProps {
  tier: string | null;
  tierName: string | null;
  tierStyle: string | null;
  discountPercent: number;
  kohaiBalance: number | null;
  compact?: boolean;
}

interface TierInfo {
  name: string;
  required: number;
  discount: number;
  style: string;
}

// TIER THRESHOLDS - Match backend configuration
const TIERS: TierInfo[] = [
  { name: "Elite", required: 50000, discount: 1, style: "silver" },
  { name: "Grandmaster", required: 500000, discount: 2, style: "gold" },
  { name: "Legend", required: 3000000, discount: 3, style: "orange" }
];

/**
 * UserTierDisplay Component
 * Displays comprehensive VIP tier information including:
 * - Current tier badge
 * - KOHAI balance
 * - Discount percentage
 * - Progress to next tier
 */
const UserTierDisplay: React.FC<UserTierDisplayProps> = ({
  tier,
  tierName,
  tierStyle,
  discountPercent,
  kohaiBalance,
  compact = false
}) => {
  const balance = kohaiBalance || 0;

  // Treat "none" as no tier
  const hasActualTier = tier && tierName && tierName.toLowerCase() !== 'none';

  // Get tier info from tier name
  const getTierInfo = (tierName: string | null) => {
    if (!tierName || tierName.toLowerCase() === 'none') return null;
    return TIERS.find(t => t.name.toLowerCase() === tierName.toLowerCase());
  };

  const tierInfo = getTierInfo(tierName);

  // Always use backend discountPercent if provided (>= 0), otherwise fallback to tier config
  const actualDiscount = (discountPercent !== undefined && discountPercent !== null && discountPercent >= 0)
    ? discountPercent
    : (tierInfo?.discount || 0);

  // Use provided style or calculate from tier
  const actualStyle = tierStyle || (tierInfo?.style || null);

  // Calculate what tier user SHOULD have based on balance (frontend fallback)
  const calculateTierFromBalance = (balance: number): TierInfo | null => {
    // Find highest tier the user qualifies for
    for (let i = TIERS.length - 1; i >= 0; i--) {
      if (balance >= TIERS[i].required) {
        return TIERS[i];
      }
    }
    return null;
  };

  const shouldHaveTier = calculateTierFromBalance(balance);

  // Find next tier based on current situation
  let nextTier: TierInfo | undefined;
  if (hasActualTier) {
    // User has a tier - find the next one after their current tier
    const currentTierIndex = TIERS.findIndex(t => t.name.toLowerCase() === tierName!.toLowerCase());
    nextTier = currentTierIndex >= 0 && currentTierIndex < TIERS.length - 1
      ? TIERS[currentTierIndex + 1]
      : undefined;
  } else {
    // User has no tier - find the first tier they haven't reached yet
    nextTier = TIERS.find(t => balance < t.required);
  }

  // Calculate progress percentage
  const progressPercent = nextTier
    ? Math.min((balance / nextTier.required) * 100, 100)
    : 100;

  const remainingTokens = nextTier ? nextTier.required - balance : 0;

  if (compact) {
    return (
      <div className={styles.compactDisplay}>
        {hasActualTier ? (
          <TierBadge
            tierName={tierName}
            tierStyle={actualStyle}
            discountPercent={actualDiscount}
            compact
          />
        ) : (
          <div className={styles.noTier}>
            <span className={styles.noTierText}>No VIP Tier</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.tierDisplay}>
      <div className={styles.header}>
        <h3 className={styles.title}>VIP Status</h3>
      </div>

      {hasActualTier ? (
        <div className={styles.currentTier}>
<div className={styles.infoRow}>
            <span className={styles.currentTierLabel}>Current Tier: </span>
            <TierBadge
              tierName={tierName}
              tierStyle={actualStyle}
              discountPercent={actualDiscount}
            />
          </div>
          <div className={styles.tierInfo}>
            <div className={styles.infoRow}>
              <span className={styles.label}>Balance:</span>
              <span className={styles.value}>
                {balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} $KOHAI
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>Discount:</span>
              <span className={styles.discount}>{actualDiscount}% OFF</span>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.noTierSection}>
          {shouldHaveTier ? (
            <>
              <p className={styles.noTierMessage}>
                🎉 You qualify for {shouldHaveTier.name} tier!
              </p>
              <p className={styles.noTierMessage} style={{ fontSize: '0.9em', opacity: 0.8 }}>
                Your tier will be activated automatically. Refresh the page to see your {shouldHaveTier.discount}% discount!
              </p>
            </>
          ) : (
            <p className={styles.noTierMessage}>
              Hold 50,000 $KOHAI to unlock Elite tier!
            </p>
          )}
          <div className={styles.infoRow}>
            <span className={styles.label}>Your Balance:</span>
            <span className={styles.value}>
              {balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} $KOHAI
            </span>
          </div>
        </div>
      )}

      {nextTier && (
        <div className={styles.nextTier}>
          <p className={styles.nextTierLabel}>Next Tier: {nextTier.name}</p>
          <div className={styles.progressBar}>
            <div
              className={styles.progress}
              style={{
                width: `${progressPercent}%`,
                background: getTierColor(nextTier.style)
              }}
            />
          </div>
          <p className={styles.requirement}>
            {remainingTokens.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} $KOHAI needed
          </p>
        </div>
      )}

      {!nextTier && hasActualTier && tierName?.toLowerCase() === "legend" && (
        <div className={styles.maxTier}>
          <p className={styles.maxTierText}>🎉 Maximum Tier Reached!</p>
        </div>
      )}
    </div>
  );
};

function getTierColor(style: string): string {
  switch (style) {
    case "orange": return "linear-gradient(90deg, #FF6B35 0%, #FF8C42 100%)";
    case "gold": return "linear-gradient(90deg, #FFD700 0%, #FFA500 100%)";
    case "silver": return "linear-gradient(90deg, #C0C0C0 0%, #E8E8E8 100%)";
    default: return "#999";
  }
}

export default UserTierDisplay;
