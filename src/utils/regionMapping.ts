/**
 * Region Mapping Utility
 * Maps region codes to full country names and flag emojis
 *
 * This utility is designed to be future-proof:
 * - Automatically handles multi-region codes (MY/SG, PH/TH, etc.)
 * - Gracefully handles unknown region codes
 * - No manual updates needed when new regions appear
 */

/**
 * Comprehensive mapping of ISO country codes to names and flag emojis
 * Covers all common gaming regions worldwide
 */
export const COUNTRY_MAP: Record<string, { name: string; flag: string }> = {
  // Southeast Asia
  MY: { name: "Malaysia", flag: "🇲🇾" },
  SG: { name: "Singapore", flag: "🇸🇬" },
  PH: { name: "Philippines", flag: "🇵🇭" },
  TH: { name: "Thailand", flag: "🇹🇭" },
  VN: { name: "Vietnam", flag: "🇻🇳" },
  ID: { name: "Indonesia", flag: "🇮🇩" },
  BN: { name: "Brunei", flag: "🇧🇳" },
  KH: { name: "Cambodia", flag: "🇰🇭" },
  LA: { name: "Laos", flag: "🇱🇦" },
  MM: { name: "Myanmar", flag: "🇲🇲" },

  // East Asia
  CN: { name: "China", flag: "🇨🇳" },
  JP: { name: "Japan", flag: "🇯🇵" },
  KR: { name: "South Korea", flag: "🇰🇷" },
  TW: { name: "Taiwan", flag: "🇹🇼" },
  HK: { name: "Hong Kong", flag: "🇭🇰" },
  MO: { name: "Macau", flag: "🇲🇴" },

  // South Asia
  IN: { name: "India", flag: "🇮🇳" },
  PK: { name: "Pakistan", flag: "🇵🇰" },
  BD: { name: "Bangladesh", flag: "🇧🇩" },
  LK: { name: "Sri Lanka", flag: "🇱🇰" },
  NP: { name: "Nepal", flag: "🇳🇵" },

  // Americas
  US: { name: "United States", flag: "🇺🇸" },
  CA: { name: "Canada", flag: "🇨🇦" },
  MX: { name: "Mexico", flag: "🇲🇽" },
  BR: { name: "Brazil", flag: "🇧🇷" },
  AR: { name: "Argentina", flag: "🇦🇷" },
  CL: { name: "Chile", flag: "🇨🇱" },
  CO: { name: "Colombia", flag: "🇨🇴" },
  PE: { name: "Peru", flag: "🇵🇪" },

  // Europe
  GB: { name: "United Kingdom", flag: "🇬🇧" },
  UK: { name: "United Kingdom", flag: "🇬🇧" },
  DE: { name: "Germany", flag: "🇩🇪" },
  FR: { name: "France", flag: "🇫🇷" },
  IT: { name: "Italy", flag: "🇮🇹" },
  ES: { name: "Spain", flag: "🇪🇸" },
  PT: { name: "Portugal", flag: "🇵🇹" },
  NL: { name: "Netherlands", flag: "🇳🇱" },
  BE: { name: "Belgium", flag: "🇧🇪" },
  SE: { name: "Sweden", flag: "🇸🇪" },
  NO: { name: "Norway", flag: "🇳🇴" },
  DK: { name: "Denmark", flag: "🇩🇰" },
  FI: { name: "Finland", flag: "🇫🇮" },
  PL: { name: "Poland", flag: "🇵🇱" },
  RU: { name: "Russia", flag: "🇷🇺" },
  TR: { name: "Turkey", flag: "🇹🇷" },

  // Middle East
  AE: { name: "UAE", flag: "🇦🇪" },
  SA: { name: "Saudi Arabia", flag: "🇸🇦" },
  IL: { name: "Israel", flag: "🇮🇱" },
  EG: { name: "Egypt", flag: "🇪🇬" },

  // Oceania
  AU: { name: "Australia", flag: "🇦🇺" },
  NZ: { name: "New Zealand", flag: "🇳🇿" },

  // Africa
  ZA: { name: "South Africa", flag: "🇿🇦" },
  NG: { name: "Nigeria", flag: "🇳🇬" },
  KE: { name: "Kenya", flag: "🇰🇪" },

  // Regional Groups (Common in gaming)
  SEA: { name: "Southeast Asia", flag: "🌏" },
  EU: { name: "Europe", flag: "🇪🇺" },
  NA: { name: "North America", flag: "🌎" },
  LATAM: { name: "Latin America", flag: "🌎" },
  ME: { name: "Middle East", flag: "🌍" },
  MENA: { name: "Middle East & North Africa", flag: "🌍" },
  OCE: { name: "Oceania", flag: "🌏" },
  AS: { name: "Asia", flag: "🌏" },
  ASIA: { name: "Asia", flag: "🌏" },
  GLOBAL: { name: "Global", flag: "🌐" },
  WW: { name: "Worldwide", flag: "🌐" },
};

/**
 * Get country info by code
 * Returns the country name and flag, or creates a fallback for unknown codes
 *
 * @param code - ISO country code (e.g., "MY", "US")
 * @returns Object with name and flag
 */
export function getCountryInfo(code: string): { name: string; flag: string } {
  const upperCode = code.trim().toUpperCase();

  // Check if we have a mapping
  if (COUNTRY_MAP[upperCode]) {
    return COUNTRY_MAP[upperCode];
  }

  // Fallback for unknown codes - still display them gracefully
  return {
    name: upperCode,
    flag: "🏴", // Generic flag for unknown regions
  };
}

/**
 * Format a region code into a user-friendly display string
 * Handles both single codes (MY) and multi-codes (MY/SG)
 *
 * Examples:
 * - "MY" → "🇲🇾 Malaysia"
 * - "MY/SG" → "🇲🇾🇸🇬 Malaysia / Singapore"
 * - "US" → "🇺🇸 United States"
 * - "SEA" → "🌏 Southeast Asia"
 * - "NEWCODE" → "🏴 NEWCODE" (graceful fallback)
 *
 * @param regionCode - Region code (can be single or multi-code with /)
 * @param options - Formatting options
 * @returns Formatted region display string
 */
export function formatRegionDisplay(
  regionCode: string,
  options: {
    showFlags?: boolean;
    showCodes?: boolean;
    separator?: string;
  } = {}
): string {
  const {
    showFlags = true,
    showCodes = false,
    separator = " / ",
  } = options;

  // Split by / for multi-region codes
  const codes = regionCode.split("/").map((code) => code.trim());

  // Get info for each code
  const regions = codes.map((code) => getCountryInfo(code));

  // Build flags string
  const flags = showFlags ? regions.map((r) => r.flag).join("") + " " : "";

  // Build names string
  const names = regions.map((r) => r.name).join(separator);

  // Optionally add codes in parentheses
  const codesSuffix = showCodes ? ` (${regionCode})` : "";

  return `${flags}${names}${codesSuffix}`;
}

/**
 * Format region display with code suffix (for dropdown display)
 * Shows both the user-friendly name and the original code
 *
 * Example:
 * - "MY/SG" → "🇲🇾🇸🇬 Malaysia / Singapore (MY/SG)"
 *
 * @param regionCode - Region code
 * @returns Formatted string with code in parentheses
 */
export function formatRegionWithCode(regionCode: string): string {
  return formatRegionDisplay(regionCode, { showFlags: true, showCodes: true });
}

/**
 * Format region display for compact spaces (mobile, small screens)
 * Shows flags and abbreviated names
 *
 * Example:
 * - "MY/SG" → "🇲🇾🇸🇬 MY/SG"
 *
 * @param regionCode - Region code
 * @returns Compact formatted string
 */
export function formatRegionCompact(regionCode: string): string {
  const codes = regionCode.split("/").map((code) => code.trim());
  const flags = codes.map((code) => getCountryInfo(code).flag).join("");
  return `${flags} ${regionCode}`;
}

/**
 * Get just the region name(s) without flags or codes
 *
 * Example:
 * - "MY/SG" → "Malaysia / Singapore"
 *
 * @param regionCode - Region code
 * @returns Region name(s) only
 */
export function getRegionName(regionCode: string): string {
  return formatRegionDisplay(regionCode, { showFlags: false, showCodes: false });
}

/**
 * Get just the flags for a region code
 *
 * Example:
 * - "MY/SG" → "🇲🇾🇸🇬"
 *
 * @param regionCode - Region code
 * @returns Flags emoji string
 */
export function getRegionFlags(regionCode: string): string {
  const codes = regionCode.split("/").map((code) => code.trim());
  return codes.map((code) => getCountryInfo(code).flag).join("");
}

/**
 * Sort regions by priority
 * Prioritizes Southeast Asian regions, then alphabetically
 *
 * @param regions - Array of region codes
 * @returns Sorted array of region codes
 */
export function sortRegionsByPriority(regions: string[]): string[] {
  // Define priority order (popular gaming regions first)
  const priorityRegions = [
    "SEA",
    "MY/SG",
    "PH/TH",
    "TH/VN",
    "ID",
    "VN",
    "TH",
    "PH",
    "MY",
    "SG",
  ];

  return regions.sort((a, b) => {
    const aPriority = priorityRegions.indexOf(a);
    const bPriority = priorityRegions.indexOf(b);

    // Both have priority
    if (aPriority !== -1 && bPriority !== -1) {
      return aPriority - bPriority;
    }

    // Only a has priority
    if (aPriority !== -1) return -1;

    // Only b has priority
    if (bPriority !== -1) return 1;

    // Neither has priority, sort alphabetically
    return a.localeCompare(b);
  });
}

/**
 * Check if a region code is valid (exists in our mapping)
 * Note: This is informational only - unknown codes are still supported
 *
 * @param regionCode - Region code to check
 * @returns True if all codes in the region are known
 */
export function isKnownRegion(regionCode: string): boolean {
  const codes = regionCode.split("/").map((code) => code.trim().toUpperCase());
  return codes.every((code) => COUNTRY_MAP[code] !== undefined);
}

/**
 * Get region metadata (useful for analytics or filtering)
 *
 * @param regionCode - Region code
 * @returns Metadata about the region
 */
export function getRegionMetadata(regionCode: string) {
  const codes = regionCode.split("/").map((code) => code.trim());

  return {
    code: regionCode,
    displayName: formatRegionDisplay(regionCode),
    shortName: getRegionName(regionCode),
    flags: getRegionFlags(regionCode),
    isMultiRegion: codes.length > 1,
    regionCount: codes.length,
    isKnown: isKnownRegion(regionCode),
    countries: codes.map((code) => getCountryInfo(code)),
  };
}
