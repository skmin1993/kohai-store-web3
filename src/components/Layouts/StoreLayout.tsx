"use client";
// import { useGamecreditStoreLazyQuery } from "graphql/generated/graphql";
import React, { Suspense } from "react";
import FooterPremium from "../Premium/Footer";
import HeaderPremium from "../Premium/Header";
import Footer from "../User/Footer";
import Header from "../User/Header";
import MobileBottomNav from "../User/MobileBottomNav";

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isPremium = false; // You can make this dynamic if needed

  // TODO: Re-enable when backend supports gamecreditStore query
  // const [getStore, { data: storeData }] = useGamecreditStoreLazyQuery({
  //   fetchPolicy: "cache-and-network",
  // });

  // const checkSession = () => {
  //   getStore({
  //     variables: {
  //       id: process.env.NEXT_PUBLIC_STORE_ID ?? "1",
  //     },
  //   });
  // };

  // useEffect(() => {
  //   if (storeData && storeData.gamecreditStore) {
  //     setStore(storeData.gamecreditStore);
  //   }
  // }, [storeData]);

  // useEffect(() => {
  //   checkSession();
  // }, []);

  return (
    <Suspense>
      <div
        style={{
          backgroundColor: "rgb(0, 0, 0)",
          minHeight: "100vh",
          color: "#ffffff",
        }}
      >
        <div className="z-2 relative" style={{ zIndex: 2 }}>
          {isPremium ? (
            <>
              <HeaderPremium />
              <div className="container mx-auto py-4">{children}</div>
              <FooterPremium />
            </>
          ) : (
            <>
              <Header />
              <div className="container mx-auto py-4">{children}</div>
              <Footer />
            </>
          )}
        </div>
        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />
      </div>
    </Suspense>
  );
}
