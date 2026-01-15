/**
 * Product Grouping Utilities
 * Groups TopupProducts by game_name and region_code
 * Extracts both values from the product title automatically
 */

import { TopupProductFragment } from "graphql/generated/graphql";

export interface GroupedProducts {
  [gameName: string]: {
    [regionCode: string]: TopupProductFragment[];
  };
}

/**
 * Parses title to extract game_name and region_code
 * Example: "Mobile Legends: Bang Bang (MY/SG)"
 *   → { gameName: "Mobile Legends: Bang Bang", regionCode: "MY/SG" }
 *
 * Supports patterns like:
 * - "Game Name (XX)" → single region code (2-3+ letters)
 * - "Game Name (XX/YY)" → multiple region codes
 * - "Game Name (XX/YY/ZZ)" → multiple region codes
 * - "Game Name (SEA)" → 3-letter region code
 * - "Game Name (MY/SG)" → 2-letter region codes
 * - "Game Name (Russia)" → full country name
 * - "Game Name (KH/TW/Mongolia/Brunei)" → mixed codes and names
 */
export function parseProductTitle(title: string): {
  gameName: string;
  regionCode: string;
} {
  // Match pattern: "Game Name (REGION_CODE)" where region can be:
  // - 2+ letters (uppercase or mixed case for full country names)
  // - Multiple regions separated by /
  // Supports: (MY) (SEA) (MY/SG) (Russia) (KH/TW/Mongolia/Brunei) etc.
  const match = title.match(/^(.+?)\s*\(([A-Za-z]{2,}(?:\/[A-Za-z]{2,})*)\)$/);

  if (match) {
    return {
      gameName: match[1].trim(),
      regionCode: match[2].trim(),
    };
  }

  // Fallback: use full title as game name with UNKNOWN region
  return {
    gameName: title,
    regionCode: "UNKNOWN",
  };
}

/**
 * Groups products by game_name, then by region_code
 * Extracts both values from the title field automatically
 *
 * @param products - Array of TopupProductFragment objects
 * @returns Nested object with games → regions → products
 *
 * @example
 * const grouped = groupProductsByGameAndRegion(products);
 * // Result:
 * // {
 * //   "Mobile Legends: Bang Bang": {
 * //     "MY/SG": [product1, product2],
 * //     "TH/VN": [product3]
 * //   },
 * //   "Genshin Impact": {
 * //     "US": [product4]
 * //   }
 * // }
 */
export function groupProductsByGameAndRegion(
  products: TopupProductFragment[]
): GroupedProducts {
  const grouped: GroupedProducts = {};

  products.forEach((product) => {
    // Extract game_name and region_code from title
    const { gameName, regionCode } = parseProductTitle(product.title);

    // Initialize game if not exists
    if (!grouped[gameName]) {
      grouped[gameName] = {};
    }

    // Initialize region if not exists
    if (!grouped[gameName][regionCode]) {
      grouped[gameName][regionCode] = [];
    }

    // Add product to grouped structure
    grouped[gameName][regionCode].push(product);
  });

  return grouped;
}

/**
 * Get unique games from grouped products
 * Returns games sorted alphabetically
 *
 * @param grouped - Grouped products object (from groupProductsByGameAndRegion)
 * @returns Array of unique game names, sorted
 */
export function getUniqueGames(grouped: GroupedProducts): string[] {
  return Object.keys(grouped).sort();
}

/**
 * Get regions for a specific game
 * Returns regions sorted alphabetically
 *
 * @param grouped - Grouped products object
 * @param gameName - Name of the game to get regions for
 * @returns Array of region codes for that game, sorted
 */
export function getRegionsForGame(
  grouped: GroupedProducts,
  gameName: string
): string[] {
  if (!grouped[gameName]) return [];
  return Object.keys(grouped[gameName]).sort();
}

/**
 * Get products for a specific game and region
 *
 * @param grouped - Grouped products object
 * @param gameName - Name of the game
 * @param regionCode - Region code
 * @returns Array of TopupProductFragment for that game/region combination
 */
export function getProductsForGameAndRegion(
  grouped: GroupedProducts,
  gameName: string,
  regionCode: string
): TopupProductFragment[] {
  return grouped[gameName]?.[regionCode] || [];
}

/**
 * Get total count of products for a game
 *
 * @param grouped - Grouped products object
 * @param gameName - Name of the game
 * @returns Total number of products across all regions for that game
 */
export function getProductCountForGame(
  grouped: GroupedProducts,
  gameName: string
): number {
  if (!grouped[gameName]) return 0;
  return Object.values(grouped[gameName]).reduce(
    (total, products) => total + products.length,
    0
  );
}

/**
 * Get total count of products for a game and region
 *
 * @param grouped - Grouped products object
 * @param gameName - Name of the game
 * @param regionCode - Region code
 * @returns Number of products for that game/region combination
 */
export function getProductCountForGameAndRegion(
  grouped: GroupedProducts,
  gameName: string,
  regionCode: string
): number {
  return getProductsForGameAndRegion(grouped, gameName, regionCode).length;
}

/**
 * Flatten grouped products back to a single array
 * Useful for resetting filters or exporting data
 *
 * @param grouped - Grouped products object
 * @returns Flat array of all TopupProductFragment objects
 */
export function flattenGroupedProducts(grouped: GroupedProducts): TopupProductFragment[] {
  const flattened: TopupProductFragment[] = [];

  Object.values(grouped).forEach((gameRegions) => {
    Object.values(gameRegions).forEach((products) => {
      flattened.push(...products);
    });
  });

  return flattened;
}

/**
 * Search products by game name or region code
 * Performs case-insensitive partial matching
 *
 * @param grouped - Grouped products object
 * @param searchTerm - Search term (game name or region)
 * @returns Filtered grouped products
 */
export function searchProducts(
  grouped: GroupedProducts,
  searchTerm: string
): GroupedProducts {
  const term = searchTerm.toLowerCase();
  const result: GroupedProducts = {};

  Object.entries(grouped).forEach(([gameName, regions]) => {
    // Check if game name matches
    if (gameName.toLowerCase().includes(term)) {
      result[gameName] = regions;
      return;
    }

    // Check if any region code matches
    const matchingRegions: { [key: string]: TopupProductFragment[] } = {};
    let hasMatch = false;

    Object.entries(regions).forEach(([regionCode, products]) => {
      if (regionCode.toLowerCase().includes(term)) {
        matchingRegions[regionCode] = products;
        hasMatch = true;
      }
    });

    if (hasMatch) {
      result[gameName] = matchingRegions;
    }
  });

  return result;
}

/**
 * Type-safe filter for a specific region across all games
 *
 * @param grouped - Grouped products object
 * @param regionCode - Region code to filter by
 * @returns Grouped products containing only the specified region
 */
export function filterByRegion(
  grouped: GroupedProducts,
  regionCode: string
): GroupedProducts {
  const result: GroupedProducts = {};

  Object.entries(grouped).forEach(([gameName, regions]) => {
    if (regions[regionCode]) {
      result[gameName] = { [regionCode]: regions[regionCode] };
    }
  });

  return result;
}

/**
 * Get all unique region codes across all games
 * Returns regions sorted alphabetically
 *
 * @param grouped - Grouped products object
 * @returns Array of all unique region codes
 */
export function getAllRegionCodes(grouped: GroupedProducts): string[] {
  const regions = new Set<string>();

  Object.values(grouped).forEach((gameRegions) => {
    Object.keys(gameRegions).forEach((regionCode) => {
      regions.add(regionCode);
    });
  });

  return Array.from(regions).sort();
}

/**
 * Get summary statistics for grouped products
 *
 * @param grouped - Grouped products object
 * @returns Object with statistics
 */
export function getGroupingStatistics(grouped: GroupedProducts) {
  const stats = {
    totalProducts: 0,
    totalGames: 0,
    totalRegions: 0,
    gameRegionMap: {} as { [game: string]: number },
  };

  Object.entries(grouped).forEach(([gameName, regions]) => {
    stats.totalGames += 1;
    stats.gameRegionMap[gameName] = Object.keys(regions).length;
    stats.totalRegions += Object.keys(regions).length;

    Object.values(regions).forEach((products) => {
      stats.totalProducts += products.length;
    });
  });

  return stats;
}
