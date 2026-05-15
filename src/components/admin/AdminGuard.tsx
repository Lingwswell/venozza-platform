"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthToken } from "@/lib/auth/token";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      router.replace("/admin/login");
      return;
    }

    try {
      // valida formato básico do JWT
      const parts = token.split(".");
      if (parts.length !== 3) {
        throw new Error("Token inválido");
      }

      const payload = JSON.parse(atob(parts[1]));

      // valida expiração
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        throw new Error("Token expirado");
      }

      setReady(true);
    } catch {
      localStorage.removeItem("venozza_token");
      localStorage.removeItem("venozza_user");
      sessionStorage.removeItem("venozza_token");
      sessionStorage.removeItem("venozza_user");

      router.replace("/admin/login");
    }
  }, [router]);

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-white">
        <div className="text-sm opacity-80">Validando acesso do admin...</div>
      </main>
    );
  }

  return <>{children}</>;
}
