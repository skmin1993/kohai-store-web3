/**
 * Product Categorization Utility
 * Categorizes products into: Favourite, Popular, New Release, Trending, Others
 * Each product is assigned to ONE category based on priority.
 * Priority: Favourite > Popular > New Release > Trending > Others
 */

export type CategoryType = "others" | "favourite" | "popular" | "new_release" | "trending";
export type PlatformType = "mobile" | "pc" | "console";

export interface CategorizedProduct {
  product: any;
  categories: CategoryType[];
  platform: PlatformType;
}

/**
 * Determines platform type from product category field
 */
export const getPlatform = (product: any): PlatformType => {
  const category = product.category?.toLowerCase() || "";
  
  if (category.includes("mobile")) return "mobile";
  if (category.includes("pc")) return "pc";
  if (category.includes("console")) return "console";
  
  return "mobile"; // default fallback
};

/**
 * Determines if product is new (released in last 60 days)
 */
export const isNewRelease = (product: any): boolean => {
  if (!product.createdAt) return false;
  
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60); // Changed from 30 to 60
  
  const productDate = new Date(product.createdAt);
  return productDate > sixtyDaysAgo;
};

/**
 * Determines if product is popular (based on sales, clicks, or ratings)
 * Adjust logic based on your data
 */
export const isPopular = (product: any): boolean => {
  // Method 1: Based on featured flag (primary indicator of popularity)
  if (product.featured) return true;
  
  // Method 2: Based on sales count
  if (product.sales && product.sales > 100) return true;
  
  // Method 3: Based on rating
  if (product.rating && product.rating >= 4.5) return true;
  
  // Method 4: Based on purchase count
  if (product.purchaseCount && product.purchaseCount > 50) return true;
  
  return false;
};

/**
 * Determines if product is trending (popular recently)
 * Can be based on recent sales velocity or engagement
 */
export const isTrending = (product: any): boolean => {
  // Method 1: Recent popularity spike
  if (product.recentSales && product.recentSales > 10) return true;
  
  // Method 2: High engagement in last week
  if (product.weeklyPurchases && product.weeklyPurchases > 20) return true;
  
  // Method 3: Trending flag from backend
  if (product.isTrending) return true;
  
  return false;
};

/**
 * Checks if product is in user's favourites
 */
export const isFavourite = (product: any, favouriteIds?: string[]): boolean => {
  if (!favouriteIds) {
    console.log('⚠️ isFavourite: No favouriteIds provided for product:', product.id);
    return false;
  }
  
  const isFav = favouriteIds.includes(product.id);
  if (isFav) {
    console.log('❤️ isFavourite: Product', product.id, 'is favourite');
  }
  return isFav;
};

/**
 * Categorizes a product into MULTIPLE categories:
 * A product can be in multiple categories (e.g., both "favourite" and "popular")
 */
export const categorizeProduct = (
  product: any,
  favouriteIds?: string[]
): CategorizedProduct => {
  const categories: CategoryType[] = [];

  console.log('🔍 Categorizing product:', {
    id: product.id,
    title: product.title,
    favouriteIds,
    isFav: isFavourite(product, favouriteIds),
  });

  // Check all conditions and add ALL matching categories
  const isFav = isFavourite(product, favouriteIds);
  const isPop = isPopular(product);
  const isNew = isNewRelease(product);
  const isTrend = isTrending(product);

  if (isFav) {
    categories.push("favourite");
  }

  if (isPop) {
    categories.push("popular");
  }

  if (isNew) {
    categories.push("new_release");
  }

  if (isTrend) {
    categories.push("trending");
  }

  // "Others" = products that are NOT popular, trending, or new release
  // They can still be favourited (will be in both "others" AND "favourite")
  const isInSpecialCategory = isPop || isNew || isTrend;
  if (!isInSpecialCategory) {
    categories.push("others");
  }

  console.log('✅ Product categorized:', {
    id: product.id,
    title: product.title,
    isFavourite: isFav,
    isPopular: isPop,
    categories: categories
  });

  return {
    product,
    categories,
    platform: getPlatform(product),
  };
};

/**
 * Filters products by category and platform
 */
export const filterProductsByCategory = (
  products: any[],
  selectedCategory: CategoryType | null,
  selectedPlatform?: PlatformType,
  favouriteIds?: string[]
): any[] => {
  // Ensure we have a mutable array
  const productList = Array.isArray(products) ? [...products] : [];

  // If no category selected, show all products (apply platform filter if provided)
  if (!selectedCategory) {
    if (!selectedPlatform) {
      return productList;
    }
    // Apply only platform filter
    return productList.filter(product => {
      const categorized = categorizeProduct(product, favouriteIds);
      return categorized.platform === selectedPlatform;
    });
  }

  return productList.filter(product => {
    // Always show featured products
    if (product.featured) return true;
    const categorized = categorizeProduct(product, favouriteIds);
    // Check category match (since categories is now an array with one item)
    const categoryMatch = categorized.categories.includes(selectedCategory);
    // Check platform match
    const platformMatch = !selectedPlatform || categorized.platform === selectedPlatform;
    return categoryMatch && platformMatch;
  });
};

/**
 * Gets all categorized products, sorted by ordering (ascending, 1 first)
 */
export const getCategorizedProducts = (
  products: any[],
  favouriteIds?: string[]
): CategorizedProduct[] => {
  // Ensure we have a mutable array
  const productList = Array.isArray(products) ? [...products] : [];

  // Sort by ordering (ascending: 1 first, null/undefined at the end)
  const sortedProducts = productList.sort((a, b) => {
    const orderA = a.ordering ? parseInt(a.ordering, 10) : Number.MAX_SAFE_INTEGER;
    const orderB = b.ordering ? parseInt(b.ordering, 10) : Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });

  return sortedProducts.map(product => categorizeProduct(product, favouriteIds));
};

/**
 * Gets statistics about products
 */
export const getCategoryStats = (products: any[], favouriteIds?: string[]) => {
  // Ensure we have a mutable array
  const productList = Array.isArray(products) ? [...products] : [];
  const categorized = getCategorizedProducts(productList, favouriteIds);

  return {
    favourite: categorized.filter(p => p.categories.includes("favourite")).length,
    popular: categorized.filter(p => p.categories.includes("popular")).length,
    new_release: categorized.filter(p => p.categories.includes("new_release")).length,
    trending: categorized.filter(p => p.categories.includes("trending")).length,
    others: categorized.filter(p => p.categories.includes("others")).length,
    byPlatform: {
      mobile: categorized.filter(p => p.platform === "mobile").length,
      pc: categorized.filter(p => p.platform === "pc").length,
      console: categorized.filter(p => p.platform === "console").length,
    },
  };
};
