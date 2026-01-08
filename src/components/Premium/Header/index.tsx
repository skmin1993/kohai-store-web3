"use client";
import Link from "next/link";

import SearchDrawer from "@/components/Inputs/SearchDrawer";
import SearchPremium from "@/components/Inputs/SearchPremium";
import WalletButton from "@/components/WalletConnect/WalletButton";
import { HeaderCurrencySelector } from "@/components/Store/CurrencySelector";
import StakeButton from "@/components/Staking/StakeButton";
import { useEffect, useState } from "react";
import { CiSearch } from "react-icons/ci";
import styles from "./Header.module.css";

const HeaderPremium = (props: { slug?: string }) => {

  const [scrolled, setScrolled] = useState(false);

  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30); // adjust threshold as needed
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header className="fixed z-999 w-full" style={{ backgroundColor: "rgb(0, 0, 0)" }}>
        <div className="container mx-auto">
          <Link
            href={!!props.slug ? `/${props.slug}` : "/"}
            className="flex items-center justify-center py-3 transition-all duration-200 ease-in-out"
            style={{ height: scrolled ? 0 : 100 }}
          >
            <img
              src="https://indo-api.kohai.gg/rails/active_storage/blobs/redirect/eyJfcmFpbHMiOnsibWVzc2FnZSI6IkJBaHBBNDVKQ0E9PSIsImV4cCI6bnVsbCwicHVyIjoiYmxvYl9pZCJ9fQ==--d5f157c8b95d20eb8831136a8e01a2ce2d15f784/LOGO_TEXT.png"
              alt="Kohai Logo"
              className={styles.logoText}
            />
          </Link>

          <div className="flex items-center justify-between gap-3">
            <SearchPremium slug={props.slug} />
            <div className="flex items-center gap-3">
              <HeaderCurrencySelector />
              <StakeButton className="hidden md:flex items-center gap-2 rounded-lg bg-purple-500/20 border border-purple-500/30 px-3 py-2 text-xs font-semibold text-purple-300 transition hover:bg-purple-500/30" />
              <WalletButton />
              <div
                className={`rounded-md bg-white/10 backdrop-blur-md md:hidden ${styles.drawerBtn}`}
                onClick={() => setExpanded(true)}
              >
                <CiSearch size={18} />
              </div>
            </div>
          </div>
        </div>
      </header>
      <div className="hidden md:block" style={{ height: 200 }} />
      <div className="block md:hidden" style={{ height: 90 }} />

      <div
        className={`transitions-all fixed bottom-0 top-0 z-9999 w-full bg-black/50 p-5 backdrop-blur-md duration-200 ${expanded ? "left-0 block" : "left-100 hidden"}`}
      >
        <SearchDrawer
          slug={props.slug}
          closeAction={() => setExpanded(false)}
        />
      </div>
    </>
  );
};

export default HeaderPremium;
