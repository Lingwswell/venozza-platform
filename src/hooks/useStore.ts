import { useState, useEffect } from "react";

export function useStore() {
  const [storeId, setStoreId] = useState<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("store_id");
    if (saved) setStoreId(Number(saved));
  }, []);

  function changeStore(id: number) {
    localStorage.setItem("store_id", String(id));
    setStoreId(id);
  }

  return {
    storeId,
    changeStore,
  };
}
