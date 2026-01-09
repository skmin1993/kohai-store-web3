"use client";

import React from "react";
import styles from "./TierBadge.module.css";

interface TierBadgeProps {
  tierName: string | null;
  tierStyle: string | null;
  discountPercent?: number;
  compact?: boolean;
}

/**
 * TierBadge Component
 * Displays user's VIP tier badge with appropriate styling
 *
 * Tier Styles:
 * - silver: Elite tier (1% discount)
 * - gold: Grandmaster tier (2% discount)
 * - orange: Legend tier (3% discount)
 */
const TierBadge: React.FC<TierBadgeProps> = ({
  tierName,
  tierStyle,
  discountPercent,
  compact = false
}) => {
  // Treat "none" as no tier
  if (!tierName || tierName.toLowerCase() === 'none') {
    return null; // No tier
  }

  // Add console log to debug
  console.log('🏷️ TierBadge rendering:', { tierName, tierStyle, discountPercent });

  // Fallback to default style based on tier name if tierStyle is missing
  let effectiveStyle = tierStyle;
  if (!effectiveStyle && tierName) {
    const lowerTier = tierName.toLowerCase();
    if (lowerTier === "elite") effectiveStyle = "silver";
    else if (lowerTier === "grandmaster") effectiveStyle = "gold";
    else if (lowerTier === "legend") effectiveStyle = "orange";
  }

  const tierClassName = `${styles.tierBadge} ${effectiveStyle ? styles[effectiveStyle] : ''}`;

  return (
    <span
      className={tierClassName}
      style={{ verticalAlign: 'middle', display: 'inline-flex', alignItems: 'center' }}
    >
      <span className={styles.badgeIcon}>👑</span>
      <span className={styles.badgeText}>{tierName}</span>
      {/* Discount percentage hidden per user request - only show tier name */}
    </span>
  );
};

export default TierBadge;
