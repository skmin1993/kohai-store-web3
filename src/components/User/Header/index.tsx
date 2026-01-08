"use client";
import Link from "next/link";

import Search from "@/components/Inputs/Search";
import WalletButton from "@/components/WalletConnect/WalletButton";
import { HeaderCurrencySelector } from "@/components/Store/CurrencySelector";
import StakeButton from "@/components/Staking/StakeButton";
import styles from "./Header.module.css";

const Header = (props: { slug?: string }) => {

  return (
    <header
      className="sticky top-0 z-999 flex w-full"
      style={{ backgroundColor: "rgb(0, 0, 0)" }}
    >
      <div className="container mx-auto">
        <div className="flex flex-grow items-center justify-between gap-4 py-4">
          <Link href={!!props.slug ? `/${props.slug}` : "/"} className="flex items-center">
            <img
              src="https://indo-api.kohai.gg/rails/active_storage/blobs/redirect/eyJfcmFpbHMiOnsibWVzc2FnZSI6IkJBaHBBNDVKQ0E9PSIsImV4cCI6bnVsbCwicHVyIjoiYmxvYl9pZCJ9fQ==--d5f157c8b95d20eb8831136a8e01a2ce2d15f784/LOGO_TEXT.png"
              alt="Kohai Logo"
              className={styles.logo}
            />
          </Link>
          <div className="flex items-center gap-3 flex-1 justify-end">
            <Search slug={props.slug} />
            <HeaderCurrencySelector />
            <StakeButton className="hidden md:flex items-center gap-2 rounded-lg bg-purple-500/20 border border-purple-500/30 px-3 py-2 text-xs font-semibold text-purple-300 transition hover:bg-purple-500/30" />
            <WalletButton />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
