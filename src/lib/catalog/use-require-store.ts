"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasSelectedStore } from "@/lib/mobile-store-context";

/** Paginas internas (produto, carrinho, checkout...) sem loja escolhida voltam para /m. */
export function useRequireStore() {
  const router = useRouter();

  useEffect(() => {
    if (!hasSelectedStore()) router.replace("/m");
  }, [router]);
}
