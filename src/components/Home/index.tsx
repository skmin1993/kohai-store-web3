"use client";

import HeroSlider from "../Store/HeroSlider";
import StoreBackground from "../Store/StoreBackground";
import TopupProducts from "../Store/TopupProducts";
import RecentOrderBar from "./RecentOrderBar";

const HomeIndex = (props: { slug?: string }) => {
  return (
    <>
      <StoreBackground />
      <HeroSlider />
      <div className="pt-4" />
      <RecentOrderBar />
      <TopupProducts slug={props.slug} />
    </>
  );
};

export default HomeIndex;
