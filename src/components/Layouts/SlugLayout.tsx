"use client";
import { useStore } from "@/contexts/StoreContext";
// TODO: Re-enable when backend supports slugStore query
// import { useSlugStoreLazyQuery } from "graphql/generated/graphql";
import { notFound } from "next/navigation";
import React, { Suspense, useEffect } from "react";
// import Loader from "../common/Loader";
import FooterPremium from "../Premium/Footer";
import HeaderPremium from "../Premium/Header";
import Footer from "../User/Footer";
import Header from "../User/Header";

export default function SlugLayout({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const { store } = useStore();

  // TODO: Re-enable when backend supports slugStore query
  // const [getStore, { data: storeData, loading: loadingStore }] =
  //   useSlugStoreLazyQuery({
  //     fetchPolicy: "cache-and-network",
  //   });

  // const checkSession = () => {
  //   getStore({
  //     variables: {
  //       slug: slug,
  //     },
  //   });
  // };

  useEffect(() => {
    const hostname = window.location.hostname;
    const port = window.location.port;

    const isAllowed =
      hostname === "store.kohai.gg" ||
      hostname.includes("kohai-store-web3.vercel.app") ||
      hostname.includes("vercel.app") ||
      (hostname === "localhost" && port === "3002");

    if (!isAllowed) {
      notFound();
    }
  }, []);

  // useEffect(() => {
  //   if (storeData && storeData.slugStore) {
  //     setStore(storeData.slugStore);
  //   }
  // }, [storeData]);

  // useEffect(() => {
  //   checkSession();
  // }, []);

  // if (!storeData || loadingStore) return <Loader />;
  // if (!storeData?.slugStore) return <h1>Store not found</h1>;

  return (
    <Suspense>
      <div
        style={{
          backgroundColor: store?.backgroundColor ?? undefined,
          minHeight: "100vh",
          color: store?.textColor ?? undefined,
        }}
      >
        <div className="z-2 relative" style={{ zIndex: 2 }}>
          {store?.isPremium ? (
            <>
              <HeaderPremium slug={slug} />
              <div className="container mx-auto py-4">{children}</div>
              <FooterPremium slug={slug} />
            </>
          ) : (
            <>
              <Header slug={slug} />
              <div className="container mx-auto py-4">{children}</div>
              <Footer slug={slug} />
            </>
          )}
        </div>
      </div>
    </Suspense>
  );
}
