import { createContext, ReactNode, useContext, useState } from "react";

// Simple Store type since GamecreditStoreFragment doesn't exist in current schema
type Store = {
  id: string;
  name?: string;
  slug?: string;
  [key: string]: any;
} | null;

interface StoreContextType {
  store: Store;
  setStore: (store: Store) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>(null);

  const value = {
    store,
    setStore,
  };

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}
