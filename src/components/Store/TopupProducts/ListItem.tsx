"use client";

import { TopupProductFragment, useTopupProductLazyQuery } from "graphql/generated/graphql";
import { useStore } from "@/contexts/StoreContext";
import { isColorDark } from "@/lib/ColorUtils";
import Link from "next/link";
import styles from "./TopupProduct.module.css";
import { useFavorites } from "@/hooks/useFavorites";
import { useState, useCallback } from "react";

const TopupProductListItem = (props: {
  item: TopupProductFragment;
  from?: string;
  slug?: string;
  onItemClick?: (item: TopupProductFragment) => void;
  showPlatform?: boolean;
  isPopular?: boolean;
}) => {
  const { store } = useStore();
  const { toggleFavorite, isFavorite, isConnected } = useFavorites();
  const { title, publisher, avatarUrl, logoUrl, slug, id, category } = props.item;
  const isProductFavorite = isFavorite(id);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [prefetchProduct] = useTopupProductLazyQuery();

  // Prefetch product data on hover for faster page load
  const handleMouseEnter = useCallback(() => {
    // Prefetch with slug
    prefetchProduct({
      variables: { id: undefined, slug: slug },
      fetchPolicy: "cache-first",
    });
  }, [prefetchProduct, slug]);

  const isButtonDark = !!store?.buttonColor
    ? isColorDark(String(store.buttonColor))
    : true;

  // Determine platform from category
  const getPlatformInfo = () => {
    const cat = category?.toLowerCase() || "";
    if (cat.includes("pc")) return { name: "PC", icon: "💻", color: "bg-purple-500" };
    if (cat.includes("console")) return { name: "Console", icon: "🎮", color: "bg-green-500" };
    return { name: "", icon: "", color: "" };
  };

  const platformInfo = getPlatformInfo();

  const handleClick = (e: React.MouseEvent) => {
    if (props.onItemClick) {
      e.preventDefault();
      props.onItemClick(props.item);
    }
  };

  const link = !!props.slug
    ? `/${props.slug}/${slug}`
    : !!props.from
      ? `/store/products/${slug}`
      : `/store/${slug}`;

  return (
    <div className="relative">
      {/* Favorite Button */}
      <button
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isTogglingFavorite) return;
          if (!isConnected) { alert('Please connect your wallet to add favorites'); return; }
          if (!id) { console.error('❌ Product ID is missing!'); return; }
          try { setIsTogglingFavorite(true); toggleFavorite(id); await new Promise(resolve => setTimeout(resolve, 300)); } finally { setIsTogglingFavorite(false); }
        }}
        disabled={isTogglingFavorite}
        className={`absolute top-2 right-2 z-20 bg-black/70 hover:bg-black/90 p-2 rounded-full transition-all shadow-lg ${isTogglingFavorite ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={{ width: 40, height: 40 }}
        aria-label={isProductFavorite ? "Remove from favorites" : "Add to favorites"}
        title={!isConnected ? "Connect wallet to add favorites" : (isProductFavorite ? "Remove from favorites" : "Add to favorites")}
      >
        {isProductFavorite ? (
          <svg className="w-6 h-6 text-red-500 fill-current" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        )}
      </button>

      <Link href={link} onClick={handleClick}>
        <div
          className={`rounded-xl overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 text-center ${styles.card} transition-all duration-300 hover:scale-[1.02] relative`}
          style={{
            backgroundImage: `url(${avatarUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className={styles.gradientOverlay}></div>

          {/* TOP Badge for Popular Items */}
          {props.isPopular && (
            <div
              className="absolute top-0 left-0 z-10 px-3 py-1.5 rounded-tl-xl rounded-br-md"
              style={{
                background: 'linear-gradient(135deg, rgba(251, 146, 60, 1) 0%, rgba(234, 88, 12, 1) 100%)',
                boxShadow: '0 2px 8px rgba(251, 146, 60, 0.4)'
              }}
            >
              <span className="text-[10px] font-extrabold text-white tracking-widest">TOP</span>
            </div>
          )}

          {/* Platform Badge removed as requested */}

          <div className={`px-4 py-5 ${styles.context}`}>
            {!!logoUrl && <img src={logoUrl} className={styles.logo} />}
          <h5 className="font-semibold">{title}</h5>
          <p className="mb-2 text-sm text-slate-300">
            {typeof publisher === 'string' ? publisher : (publisher as any)?.name || ''}
          </p>
          {!props.from && (
            <button
              className={`flex w-full justify-center rounded bg-primary p-2 font-medium uppercase text-gray text-opacity-80 hover:bg-opacity-90 ${isButtonDark ? "text-white" : "text-black"}`}
              style={{
                backgroundColor: store?.buttonColor ?? undefined,
              }}
            >
              Topup
            </button>
          )}
        </div>
      </div>
    </Link>
    </div>
  );
};

export default TopupProductListItem;
